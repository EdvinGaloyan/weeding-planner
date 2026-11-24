import { ELEMENT_SHAPES, ElementKind, ElementShape, Gradient, Guest, GuestGroup, HallData, HallElement, MEALS, MealKind, TableData } from '../types/types.ts';
import { HEAD_SEATS } from './chairs.ts';
import { ELEMENT_KINDS } from './elements.ts';
import { GROUP_COLORS, newId, reconcileSeats } from './guests.ts';

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const cleanString = (value: unknown, max = 200) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

export function isGradient(value: unknown): value is Gradient {
    return isObject(value) && typeof value.color1 === 'string' && typeof value.color2 === 'string';
}

export function isTable(value: unknown): value is TableData {
    return (
        isObject(value) &&
        isFiniteNumber(value.id) &&
        isFiniteNumber(value.capacity) &&
        (value.shape === 'round' || value.shape === 'rect') &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y)
    );
}

function normalizeElement(value: unknown): HallElement | null {
    if (!isObject(value) || !isFiniteNumber(value.id) || !ELEMENT_KINDS.includes(value.kind as ElementKind)) return null;
    if (![value.x, value.y, value.w, value.h].every(isFiniteNumber)) return null;
    const label = cleanString(value.label, 60);
    return {
        id: value.id,
        kind: value.kind as ElementKind,
        x: value.x as number,
        y: value.y as number,
        w: Math.max(24, value.w as number),
        h: Math.max(24, value.h as number),
        rotation: isFiniteNumber(value.rotation) ? value.rotation : 0,
        ...(label ? { label } : {}),
        ...(ELEMENT_SHAPES.includes(value.shape as ElementShape) ? { shape: value.shape as ElementShape } : {}),
    };
}

function normalizeGroup(value: unknown): GuestGroup | null {
    if (!isObject(value) || typeof value.id !== 'string') return null;
    const name = cleanString(value.name, 60);
    if (!name) return null;
    const color = typeof value.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(value.color) ? value.color : GROUP_COLORS[0];
    return { id: value.id, name, color };
}

function normalizeGuest(value: unknown, groupIds: Set<string>): Guest | null {
    if (!isObject(value) || typeof value.id !== 'string') return null;
    const name = cleanString(value.name, 120);
    if (!name) return null;
    const guest: Guest = { id: value.id, name };
    if (typeof value.groupId === 'string' && groupIds.has(value.groupId)) guest.groupId = value.groupId;
    if (MEALS.includes(value.meal as MealKind)) guest.meal = value.meal as MealKind;
    const note = cleanString(value.note, 300);
    if (note) guest.note = note;
    if (isFiniteNumber(value.tableId) && Number.isInteger(value.seat)) {
        guest.tableId = value.tableId;
        guest.seat = value.seat as number;
    }
    return guest;
}

/**
 * Normalises hall data coming from the server or localStorage:
 * drops malformed items, fills defaults and repairs seat assignments.
 * Also upgrades the first version of the data, where guest names were stored
 * on the tables (`table.guests = { chairIndex: name }`), to the guest list.
 * Returns null when the payload is not hall data at all.
 */
export function normalizeHall(value: unknown): HallData | null {
    if (!isObject(value) || !Array.isArray(value.tables)) return null;

    const legacyGuests: Guest[] = [];
    const tables: TableData[] = value.tables.filter(isTable).map(table => {
        const raw = table as TableData & { guests?: unknown };
        if (isObject(raw.guests)) {
            for (const [chair, name] of Object.entries(raw.guests)) {
                const seat = Number(chair);
                if (Number.isInteger(seat) && seat >= 0 && typeof name === 'string' && name.trim()) {
                    legacyGuests.push({ id: newId(), name: name.trim(), tableId: table.id, seat });
                }
            }
        }
        const tableName = cleanString(table.tableName, 80);
        return {
            id: table.id,
            capacity: Math.max(1, Math.min(60, Math.round(table.capacity))),
            shape: table.shape,
            x: table.x,
            y: table.y,
            isHeadTable: Boolean(table.isHeadTable),
            rotation: isFiniteNumber(table.rotation) ? table.rotation : 0,
            ...(isFiniteNumber(table.customSize) ? { customSize: table.customSize } : {}),
            ...(tableName ? { tableName } : {}),
        };
    });

    // Only one head table is allowed — keep the first. It always has the fixed wedding-party seats.
    let seenHead = false;
    for (const table of tables) {
        if (table.isHeadTable && seenHead) table.isHeadTable = false;
        if (table.isHeadTable) {
            seenHead = true;
            table.capacity = HEAD_SEATS;
            table.shape = 'rect';
        }
    }

    const elements = Array.isArray(value.elements)
        ? value.elements.map(normalizeElement).filter((e): e is HallElement => !!e)
        : [];
    const groups = Array.isArray(value.groups)
        ? value.groups.map(normalizeGroup).filter((g): g is GuestGroup => !!g)
        : [];
    const groupIds = new Set(groups.map(group => group.id));
    const guests = Array.isArray(value.guests)
        ? value.guests.map(guest => normalizeGuest(guest, groupIds)).filter((g): g is Guest => !!g)
        : legacyGuests;

    return {
        tables,
        elements,
        guests: reconcileSeats(guests, tables),
        groups,
        bgGradients: isGradient(value.bgGradients) ? value.bgGradients : { color1: '', color2: '' },
    };
}

/** Stable string used to compare two halls (detects unsaved changes). */
export const hallSnapshot = (hall: HallData) => JSON.stringify(hall);
