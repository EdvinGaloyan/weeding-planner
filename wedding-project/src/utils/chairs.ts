import { TableData } from '../types/types.ts';

/**
 * The head table always seats the wedding party in this order, left to right
 * (as seen from the hall): godmother, godfather, groom, bride, bridesmaid, best man.
 * Values are i18n keys.
 */
export const HEAD_ROLES = ['role_godmother', 'role_godfather', 'role_groom', 'role_bride', 'role_bridesmaid', 'role_bestman'] as const;
export const HEAD_SEATS = HEAD_ROLES.length;

/** Chairs of the couple get a special highlight. */
export const isCoupleSeat = (chairIndex: number) => chairIndex === 2 || chairIndex === 3;

export const headRoleKey = (table: Pick<TableData, 'isHeadTable'>, chairIndex: number) =>
    table.isHeadTable ? HEAD_ROLES[chairIndex] : undefined;

export interface ChairPosition {
    /** Centre of the chair relative to the table's top-left corner. */
    x: number;
    y: number;
    /** Unit vector pointing away from the table (where a name label should go). */
    nx: number;
    ny: number;
}

/**
 * Chair centres around a table of the given rendered size.
 * Shared by the hall view and the enlarged table view so both always match.
 */
export function chairLayout(table: Pick<TableData, 'capacity' | 'shape' | 'isHeadTable'>, width: number, height: number, offset: number): ChairPosition[] {
    const total = table.capacity;
    if (!total || total <= 0) return [];

    if (table.isHeadTable) {
        // Wedding party sits on one side, facing the hall
        const inset = Math.min(30, width / (total * 2));
        const step = total > 1 ? (width - inset * 2) / (total - 1) : 0;
        return Array.from({ length: total }, (_, i) => ({
            x: total > 1 ? inset + step * i : width / 2,
            y: -offset,
            nx: 0,
            ny: -1,
        }));
    }

    if (table.shape === 'round') {
        const radius = width / 2;
        const distance = radius + offset;
        return Array.from({ length: total }, (_, i) => {
            const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
            const nx = Math.cos(angle);
            const ny = Math.sin(angle);
            return { x: radius + distance * nx, y: radius + distance * ny, nx, ny };
        });
    }

    // Rectangular: distribute evenly along the perimeter
    const W = width;
    const H = height;
    const perimeter = 2 * (W + H);
    const corner = 12;
    const clamp = (v: number, max: number) => Math.max(corner, Math.min(max - corner, v));
    return Array.from({ length: total }, (_, i) => {
        const d = ((i + 0.5) / total) * perimeter;
        if (d < W) return { x: clamp(d, W), y: -offset, nx: 0, ny: -1 };
        if (d < W + H) return { x: W + offset, y: clamp(d - W, H), nx: 1, ny: 0 };
        if (d < 2 * W + H) return { x: clamp(W - (d - (W + H)), W), y: H + offset, nx: 0, ny: 1 };
        return { x: -offset, y: clamp(H - (d - (2 * W + H)), H), nx: -1, ny: 0 };
    });
}
