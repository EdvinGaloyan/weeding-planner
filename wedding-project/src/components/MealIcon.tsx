import { Tooltip } from '@mantine/core';
import { IconBabyCarriage, IconLeaf, IconMeat, IconPlant2, IconStar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { MealKind } from '../types/types.ts';

const ICONS: Record<MealKind, typeof IconLeaf> = {
    standard: IconMeat,
    vegetarian: IconLeaf,
    vegan: IconPlant2,
    kids: IconBabyCarriage,
    special: IconStar,
};

const COLORS: Record<MealKind, string> = {
    standard: '#9c6f2a',
    vegetarian: '#5f8a45',
    vegan: '#2f7d5a',
    kids: '#3f7cac',
    special: '#c2536d',
};

export function MealIcon({ meal, size = 16 }: { meal: MealKind; size?: number }) {
    const { t } = useTranslation();
    const Icon = ICONS[meal];
    return (
        <Tooltip label={t(`meal_${meal}`)}>
            <span className="meal-icon" style={{ color: COLORS[meal] }}>
                <Icon size={size} />
            </span>
        </Tooltip>
    );
}

export const mealIconComponent = (meal: MealKind) => ICONS[meal];
