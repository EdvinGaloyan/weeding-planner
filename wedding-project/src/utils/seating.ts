import { TableData, TableShapeKind } from '../types/types.ts';
import { HEAD_SEATS } from './chairs.ts';

export type TableShape = TableShapeKind | 'mixed';

/** Space taken by chairs around a table (offset + chair size) on each side. */
const CHAIR_RING = 30;
/** Minimum free space between neighbouring tables so the toolbar and chairs never collide. */
const GAP = 34;
/** Margin from the hall walls. */
const WALL = 36;
/** Extra breathing room between the wall and the head table. */
const HEAD_LABEL_SPACE = 8;

export const defaultTableSize = (table: Pick<TableData, 'isHeadTable' | 'capacity'>) =>
    table.isHeadTable ? 360 : 180 + (table.capacity - 12) * 12;

/** 1-based number of a regular table (the head table isn't counted). */
export const tableNumber = (tables: TableData[], table: TableData) =>
    tables.filter(t => !t.isHeadTable).findIndex(t => t.id === table.id) + 1;

export const tableSize =(table: Pick<TableData, 'isHeadTable' | 'capacity' | 'customSize'>) =>
    table.customSize || defaultTableSize(table);

/** Rendered width (`size`) and height of a table; `scale` shrinks regular tables during auto-layout. */
export const tableDimensions = (table: TableData, scale = 1) => {
    const size = table.isHeadTable ? tableSize(table) : tableSize(table) * scale;
    const height = table.shape === 'round' ? size : table.isHeadTable ? 90 : size * 0.65;
    return { size, height };
};

// ---------------------------------------------------------------------------
// Guest → table distribution
// ---------------------------------------------------------------------------

export interface SeatingPlan {
    /** Capacity of every regular table, largest first. */
    capacities: number[];
    headSeats: number;
}

/**
 * Fills standard tables of `perTable` seats first. The guests left over are then:
 *  - seated at a few existing tables, each enlarged up to `maxPerTable`
 *    (e.g. 100 guests, 12/14 → 6×12 + 2×14 instead of adding a 4-seat table);
 *  - or, if that would enlarge more than half of the tables, given one extra smaller table
 *    (e.g. 94 guests, 12/14 → 7×12 + 1×10).
 */
export function planSeating(guests: number, perTable: number, maxPerTable: number, headSeats: number): SeatingPlan {
    const regularGuests = Math.max(0, guests - headSeats);
    if (regularGuests === 0 || perTable <= 0) return { capacities: [], headSeats };

    const full = Math.floor(regularGuests / perTable);
    const remainder = regularGuests % perTable;
    const capacities = Array.from({ length: full }, () => perTable);
    if (remainder === 0) return { capacities, headSeats };

    const maxExtra = Math.max(0, maxPerTable - perTable);
    const tablesToEnlarge = maxExtra > 0 ? Math.ceil(remainder / maxExtra) : Infinity;

    if (full > 0 && tablesToEnlarge <= Math.ceil(full / 2)) {
        // Spread the leftover guests over as few tables as possible
        let left = remainder;
        for (let i = 0; i < tablesToEnlarge; i++) {
            const add = Math.min(maxExtra, left);
            capacities[i] += add;
            left -= add;
        }
    } else {
        capacities.push(remainder);
    }
    return { capacities, headSeats };
}

/** Groups capacities for a readable summary: [[12, 1], [11, 8]]. */
export function summarize(capacities: number[]): [number, number][] {
    const counts = new Map<number, number>();
    capacities.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
}

export function buildTables(plan: SeatingPlan, shape: TableShape, includeHead: boolean, idSeed = Date.now()): TableData[] {
    const tables: TableData[] = [];
    let id = idSeed;

    if (includeHead && plan.headSeats > 0) {
        tables.push({ id: id++, capacity: HEAD_SEATS, shape: 'rect', x: 0, y: 0, isHeadTable: true, rotation: 0 });
    }

    plan.capacities.forEach((capacity, i) => {
        const tableShape: TableShapeKind = shape === 'mixed' ? (i % 3 === 1 ? 'rect' : 'round') : shape;
        tables.push({ id: id++, capacity, shape: tableShape, x: 0, y: 0, isHeadTable: false, rotation: 0 });
    });
    return tables;
}

// ---------------------------------------------------------------------------
// Automatic layout
// ---------------------------------------------------------------------------

interface Footprint {
    w: number;
    h: number;
}

const footprint = (table: TableData, scale: number): Footprint => {
    const { size, height } = tableDimensions(table, scale);
    const angle = ((table.rotation || 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    return {
        w: size * cos + height * sin + CHAIR_RING * 2,
        h: size * sin + height * cos + CHAIR_RING * 2,
    };
};

export type LayoutOrientation = 'horizontal' | 'vertical';

/**
 * Arranges tables like a banquet hall.
 *  - horizontal: head table centred along the top wall, other tables in rows below it;
 *  - vertical:   head table centred along the left wall, other tables in columns beside it.
 * Rectangular tables are turned to match (long side along the rows / columns).
 * Tables are scaled down when needed so everything fits inside the hall.
 */
export function arrangeTables(
    tables: TableData[],
    hallWidth: number,
    hallHeight: number,
    orientation: LayoutOrientation = 'horizontal',
): TableData[] {
    if (!tables.length || hallWidth <= 0 || hallHeight <= 0) return tables;

    // Rotation each table should end up with
    const targetRotation = (table: TableData) => {
        if (table.isHeadTable) return orientation === 'vertical' ? 270 : 0; // guests face into the hall
        if (table.shape === 'rect') return orientation === 'vertical' ? 90 : 0;
        return table.rotation || 0;
    };

    if (orientation === 'horizontal') {
        return layoutRows(tables.map(t => ({ ...t, rotation: targetRotation(t) })), hallWidth, hallHeight, HEAD_LABEL_SPACE);
    }

    // Vertical = the horizontal layout computed in a hall turned by 90°.
    // Each table is laid out with a rotation 90° less, so its footprint is the transposed one,
    // then its centre is mirrored back across the diagonal (x ↔ y).
    const proxies = tables.map(t => ({ ...t, rotation: targetRotation(t) - 90 }));
    const laidOut = layoutRows(proxies, hallHeight, hallWidth, HEAD_LABEL_SPACE * 2);

    return laidOut.map(proxy => {
        const original = tables.find(t => t.id === proxy.id)!;
        const { size, height } = tableDimensions(proxy);
        const centerX = proxy.y + height / 2;
        const centerY = proxy.x + size / 2;
        return {
            ...proxy,
            rotation: targetRotation(original),
            x: Math.round(centerX - size / 2),
            y: Math.round(centerY - height / 2),
        };
    });
}

/**
 * Head table centred at the top, all other tables in evenly spaced, centred rows
 * below it (rows of equal length are staggered for a softer look when there is room).
 */
function layoutRows(tables: TableData[], hallWidth: number, hallHeight: number, labelSpace: number): TableData[] {
    const head = tables.find(t => t.isHeadTable);
    const regular = tables.filter(t => !t.isHeadTable);

    const headFoot = head ? footprint(head, 1) : { w: 0, h: 0 };
    // Extra room above the head table for the role labels (Bride, Groom, ...)
    const headLabelSpace = head ? labelSpace : 0;
    const top = WALL + (head ? headLabelSpace + headFoot.h + GAP : 0);
    const availW = hallWidth - WALL * 2;
    const availH = hallHeight - top - WALL;

    // Pick the largest scale (≤ 1) at which the grid fits the hall
    let scale = 1;
    let cols = 1;
    let rows = 1;
    let cellW = 0;
    let cellH = 0;
    for (let s = 1; s >= 0.5; s -= 0.05) {
        const feet = regular.map(t => footprint(t, s));
        cellW = Math.max(0, ...feet.map(f => f.w)) + GAP;
        cellH = Math.max(0, ...feet.map(f => f.h)) + GAP;
        cols = Math.max(1, Math.min(regular.length, Math.floor((availW + GAP) / cellW)));
        rows = Math.ceil(regular.length / cols);
        scale = s;
        if (rows * cellH - GAP <= availH) break;
    }

    // Balanced rows: e.g. 21 tables in 5 rows → 5,4,4,4,4 (never a lonely last row)
    const baseCount = Math.floor(regular.length / rows);
    const extraRows = regular.length % rows;
    const rowCounts = Array.from({ length: rows }, (_, r) => baseCount + (r < extraRows ? 1 : 0));
    cols = Math.max(1, ...rowCounts);

    const result: TableData[] = [];

    if (head) {
        const { size, height } = tableDimensions(head);
        const cx = hallWidth / 2;
        const cy = WALL + headLabelSpace + headFoot.h / 2;
        result.push({ ...head, x: Math.round(cx - size / 2), y: Math.round(cy - height / 2) });
    }

    // Spread rows across the available height for an airy look
    const usedH = rows * cellH - GAP;
    const rowGap = rows > 1 ? Math.min(cellH * 0.6, (availH - usedH) / (rows - 1)) : 0;
    const blockH = usedH + rowGap * (rows - 1);
    const startY = top + Math.max(0, (availH - blockH) / 2);

    const rowStarts = rowCounts.map((_, r) => rowCounts.slice(0, r).reduce((a, b) => a + b, 0));
    const allRowsEqual = rowCounts.every(c => c === rowCounts[0]);
    const slack = availW - (cols * cellW - GAP);

    regular.forEach((table, i) => {
        let row = 0;
        while (row + 1 < rows && i >= rowStarts[row + 1]) row++;
        const inRow = rowCounts[row];
        const col = i - rowStarts[row];
        const rowWidth = inRow * cellW - GAP;
        let rowStartX = WALL + (availW - rowWidth) / 2;

        // Rows of equal length look stiff — stagger them by a quarter cell when there is room.
        // (Rows of different length are already naturally offset by centering.)
        if (allRowsEqual && rows > 1 && slack > cellW / 2) rowStartX += row % 2 === 0 ? -cellW / 4 : cellW / 4;

        const cx = rowStartX + col * cellW + (cellW - GAP) / 2;
        const cy = startY + row * (cellH + rowGap) + (cellH - GAP) / 2;

        const scaledSize = Math.round(tableSize(table) * scale);
        const next: TableData = { ...table, customSize: scale < 1 ? scaledSize : table.customSize };
        const { size, height } = tableDimensions(next);
        result.push({ ...next, x: Math.round(cx - size / 2), y: Math.round(cy - height / 2) });
    });

    // Keep original order (head table index is used for numbering)
    const byId = new Map(result.map(t => [t.id, t]));
    return tables.map(t => byId.get(t.id) || t);
}
