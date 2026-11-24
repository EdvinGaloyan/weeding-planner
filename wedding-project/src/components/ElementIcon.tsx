import {
    IconBottle,
    IconCamera,
    IconCircleDot,
    IconDisc,
    IconDoorEnter,
    IconMicrophone2,
    IconMusic,
    IconSalad,
    IconCake,
} from '@tabler/icons-react';
import { ElementKind } from '../types/types.ts';

const ICONS: Record<ElementKind, typeof IconMusic> = {
    stage: IconMicrophone2,
    dance: IconMusic,
    dj: IconDisc,
    entrance: IconDoorEnter,
    bar: IconBottle,
    cake: IconCake,
    photo: IconCamera,
    buffet: IconSalad,
    column: IconCircleDot,
};

export function ElementIcon({ kind, size = 18 }: { kind: ElementKind; size?: number }) {
    const Icon = ICONS[kind];
    return <Icon size={size} stroke={1.6} />;
}
