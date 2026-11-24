import { Guest, GuestGroup, HallData, MealKind, MEALS, TableData } from '../types/types.ts';

export const newId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Colours that read well on the gold chairs and in print. */
export const GROUP_COLORS = ['#c2536d', '#3f7cac', '#6f9a54', '#c08a2e', '#8a5fb0', '#2f9c95', '#d0703c', '#6b6f80'];

/** Groups every new wedding starts with (names in the current UI language). */
export function defaultGroups(t: (key: string) => string): GuestGroup[] {
    return ['group_bride', 'group_groom', 'group_friends', 'group_colleagues'].map((key, i) => ({
        id: newId(),
        name: t(key),
        color: GROUP_COLORS[i],
    }));
}

export const seatKey = (tableId: number, seat: number) => `${tableId}:${seat}`;

/** "tableId:seat" → guest, for fast chair lookups. */
export function seatIndex(guests: Guest[]): Map<string, Guest> {
    const map = new Map<string, Guest>();
    for (const guest of guests) {
        if (guest.tableId !== undefined && guest.seat !== undefined) map.set(seatKey(guest.tableId, guest.seat), guest);
    }
    return map;
}

export const isSeated = (guest: Guest) => guest.tableId !== undefined && guest.seat !== undefined;

export const seatCount = (table: TableData) => table.capacity;

/**
 * Makes seat assignments consistent with the tables: guests whose table is gone,
 * whose chair no longer exists or who share a chair with someone else become unseated.
 */
export function reconcileSeats(guests: Guest[], tables: TableData[]): Guest[] {
    const capacity = new Map(tables.map(table => [table.id, seatCount(table)]));
    const taken = new Set<string>();
    let changed = false;
    const next = guests.map(guest => {
        if (guest.tableId === undefined && guest.seat === undefined) return guest;
        const cap = guest.tableId !== undefined ? capacity.get(guest.tableId) : undefined;
        const key = guest.tableId !== undefined && guest.seat !== undefined ? seatKey(guest.tableId, guest.seat) : '';
        const valid = cap !== undefined && guest.seat !== undefined && guest.seat >= 0 && guest.seat < cap && !taken.has(key);
        if (valid) {
            taken.add(key);
            return guest;
        }
        changed = true;
        return unseat(guest);
    });
    return changed ? next : guests;
}

export function unseat(guest: Guest): Guest {
    const { tableId: _tableId, seat: _seat, ...rest } = guest;
    return rest;
}

/**
 * Seats every unseated guest on a free chair, keeping groups together:
 * bigger groups first, each one preferring tables where its members already sit,
 * then the table with the most free chairs. The head table is left to the wedding party.
 */
export function autoSeat(hall: HallData): Guest[] {
    const regular = hall.tables.filter(table => !table.isHeadTable);
    const occupied = seatIndex(hall.guests);
    const free = new Map<number, number[]>(
        regular.map(table => [
            table.id,
            Array.from({ length: seatCount(table) }, (_, i) => i).filter(i => !occupied.has(seatKey(table.id, i))),
        ]),
    );

    const unseated = hall.guests.filter(guest => !isSeated(guest));
    const byGroup = new Map<string, Guest[]>();
    for (const guest of unseated) {
        const key = guest.groupId || '';
        byGroup.set(key, [...(byGroup.get(key) || []), guest]);
    }

    const placed = new Map<string, { tableId: number; seat: number }>();
    const groupTables = (groupId: string) => {
        const counts = new Map<number, number>();
        for (const guest of hall.guests) {
            if ((guest.groupId || '') === groupId && guest.tableId !== undefined) {
                counts.set(guest.tableId, (counts.get(guest.tableId) || 0) + 1);
            }
        }
        return counts;
    };

    const groups = [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [groupId, members] of groups) {
        const affinity = groupTables(groupId);
        let queue = [...members];
        while (queue.length) {
            const candidates = regular.filter(table => (free.get(table.id) || []).length > 0);
            if (!candidates.length) return applyPlacements(hall.guests, placed);
            const remaining = queue.length;
            // 1) a table this group already uses, 2) a table where the rest fits, 3) the emptiest table
            const pick =
                candidates
                    .filter(table => affinity.has(table.id))
                    .sort((a, b) => (affinity.get(b.id) || 0) - (affinity.get(a.id) || 0))[0] ||
                candidates
                    .filter(table => free.get(table.id)!.length >= remaining)
                    .sort((a, b) => free.get(a.id)!.length - free.get(b.id)!.length)[0] ||
                candidates.sort((a, b) => free.get(b.id)!.length - free.get(a.id)!.length)[0];

            const seats = free.get(pick.id)!;
            const take = Math.min(seats.length, queue.length);
            queue.slice(0, take).forEach((guest, i) => placed.set(guest.id, { tableId: pick.id, seat: seats[i] }));
            free.set(pick.id, seats.slice(take));
            affinity.set(pick.id, (affinity.get(pick.id) || 0) + take);
            queue = queue.slice(take);
        }
    }
    return applyPlacements(hall.guests, placed);
}

function applyPlacements(guests: Guest[], placed: Map<string, { tableId: number; seat: number }>) {
    return guests.map(guest => (placed.has(guest.id) ? { ...guest, ...placed.get(guest.id)! } : guest));
}

// ---------------------------------------------------------------------------
// Import from Excel / CSV / plain text
// ---------------------------------------------------------------------------

export interface ImportedGuest {
    name: string;
    group?: string;
    meal?: MealKind;
    note?: string;
}

const MEAL_ALIASES: Record<string, MealKind> = {
    veg: 'vegetarian', vegetarian: 'vegetarian', 'բուսակեր': 'vegetarian', 'вегетарианец': 'vegetarian', 'вегетарианское': 'vegetarian',
    vegan: 'vegan', 'վեգան': 'vegan', 'веган': 'vegan',
    kid: 'kids', kids: 'kids', child: 'kids', 'երեխա': 'kids', 'մանկական': 'kids', 'детское': 'kids', 'ребенок': 'kids',
    special: 'special', 'հատուկ': 'special', 'особое': 'special',
    standard: 'standard', 'ստանդարտ': 'standard', 'стандарт': 'standard',
};

function parseMeal(value: string | undefined): MealKind | undefined {
    if (!value) return undefined;
    const key = value.trim().toLowerCase();
    if ((MEALS as string[]).includes(key)) return key as MealKind;
    return MEAL_ALIASES[key];
}

const HEADER_WORDS = /^(name|guest|full name|անուն|հյուր|имя|гость|фио)$/i;

/**
 * Accepts what people actually paste: a column copied from Excel / Google Sheets (tab separated),
 * a CSV export (comma or semicolon) or one name per line.
 * Columns: name, group, meal, note — only the name is required.
 */
export function parseGuestImport(text: string): ImportedGuest[] {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];

    const delimiter = ['\t', ';', ','].find(d => lines.filter(line => line.includes(d)).length >= Math.ceil(lines.length / 2));
    const split = (line: string) => (delimiter ? splitCsvLine(line, delimiter) : [line]).map(cell => cell.trim());

    const rows = lines.map(split);
    if (rows.length && HEADER_WORDS.test(rows[0][0] || '')) rows.shift();

    return rows
        .filter(row => row[0])
        .map(([name, group, meal, ...note]) => ({
            name: name.replace(/\s+/g, ' '),
            group: group || undefined,
            meal: parseMeal(meal),
            note: note.join(' ').trim() || undefined,
        }));
}

function splitCsvLine(line: string, delimiter: string): string[] {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (quoted && line[i + 1] === '"') {
                current += '"';
                i++;
            } else quoted = !quoted;
        } else if (char === delimiter && !quoted) {
            cells.push(current);
            current = '';
        } else current += char;
    }
    cells.push(current);
    return cells;
}

/** Case-insensitive search that ignores extra spaces. */
export const matchesQuery = (guest: Guest, query: string) =>
    !query.trim() || guest.name.toLowerCase().includes(query.trim().toLowerCase().replace(/\s+/g, ' '));

export const byName = (a: Guest, b: Guest) => a.name.localeCompare(b.name);
