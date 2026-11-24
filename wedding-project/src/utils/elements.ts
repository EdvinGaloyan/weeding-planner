import { ElementKind, ElementShape, HallElement } from '../types/types.ts';

export const ELEMENT_KINDS: ElementKind[] = ['stage', 'dance', 'dj', 'entrance', 'bar', 'cake', 'photo', 'buffet', 'column'];

/** Default footprint (px) of each kind of hall element. */
export const ELEMENT_SIZE: Record<ElementKind, { w: number; h: number }> = {
    stage: { w: 320, h: 120 },
    dance: { w: 280, h: 220 },
    dj: { w: 130, h: 80 },
    entrance: { w: 160, h: 46 },
    bar: { w: 220, h: 70 },
    cake: { w: 90, h: 90 },
    photo: { w: 150, h: 100 },
    buffet: { w: 260, h: 70 },
    column: { w: 44, h: 44 },
};

export const isRoundElement = (kind: ElementKind) => kind === 'cake' || kind === 'column';

export const elementShape = (element: Pick<HallElement, 'kind' | 'shape'>): ElementShape =>
    element.shape ?? (isRoundElement(element.kind) ? 'round' : 'rect');

/** Lean of a parallelogram's sides, in degrees. */
export const PARALLELOGRAM_SKEW = 18;

export const MIN_ELEMENT_SIZE = 24;

export const elementLabelKey = (kind: ElementKind) => `element_${kind}`;

export function newElement(kind: ElementKind, id: number, x: number, y: number): HallElement {
    const { w, h } = ELEMENT_SIZE[kind];
    return { id, kind, x: Math.round(x - w / 2), y: Math.round(y - h / 2), w, h, rotation: 0 };
}
