export type TableShapeKind = 'round' | 'rect';

export interface TableData {
    id: number;
    capacity: number;
    shape: TableShapeKind;
    x: number;
    y: number;
    isHeadTable: boolean;
    rotation: number;
    customSize?: number;
    tableName?: string;
}

export type MealKind = 'standard' | 'vegetarian' | 'vegan' | 'kids' | 'special';
export const MEALS: MealKind[] = ['standard', 'vegetarian', 'vegan', 'kids', 'special'];

export interface GuestGroup {
    id: string;
    name: string;
    color: string;
}

/** A guest of the wedding. When seated, `tableId` + `seat` point at a chair. */
export interface Guest {
    id: string;
    name: string;
    groupId?: string;
    meal?: MealKind;
    note?: string;
    tableId?: number;
    seat?: number;
}

export type ElementKind = 'stage' | 'dance' | 'dj' | 'entrance' | 'bar' | 'cake' | 'photo' | 'buffet' | 'column';
export type ElementShape = 'rect' | 'round' | 'parallelogram';
export const ELEMENT_SHAPES: ElementShape[] = ['rect', 'round', 'parallelogram'];

/** Non-table objects of the hall: stage, dance floor, entrance… */
export interface HallElement {
    id: number;
    kind: ElementKind;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
    label?: string;
    /** Missing → the default shape of the kind (round for cake & column). */
    shape?: ElementShape;
}

/** Radial background gradient; empty strings mean "use the default floor image". */
export interface Gradient {
    color1: string;
    color2: string;
}

/** Everything that describes one wedding in a hall and gets persisted (server + localStorage). */
export interface HallData {
    tables: TableData[];
    elements: HallElement[];
    guests: Guest[];
    groups: GuestGroup[];
    bgGradients: Gradient;
}

export const EMPTY_GRADIENT: Gradient = { color1: '', color2: '' };
export const EMPTY_HALL: HallData = { tables: [], elements: [], guests: [], groups: [], bgGradients: EMPTY_GRADIENT };

// ---- Server-side entities --------------------------------------------------------

export interface Venue {
    id: string;
    name: string;
    logo?: string;
    brandColor?: string;
}

export interface User {
    id: string;
    email: string;
}

export interface EventSummary {
    id: string;
    title: string;
    date: string;
    updatedAt: string;
    stats: { tables: number; seats: number; guests: number; seated: number };
}

export interface EventRecord {
    id: string;
    title: string;
    date: string;
    hall: HallData;
    version: number;
    shareToken: string;
    lookupToken: string;
    updatedAt: string;
}

export interface Template {
    id: string;
    name: string;
    hall: Pick<HallData, 'tables' | 'elements' | 'bgGradients'>;
    createdAt: string;
}
