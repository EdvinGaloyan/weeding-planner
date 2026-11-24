import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Rich antique gold — primary accent (buttons, borders, highlights)
const gold: MantineColorsTuple = [
    '#fdf7ea',
    '#f6e8c8',
    '#ecd29b',
    '#e2bb6d',
    '#d9a948',
    '#cf9a33',
    '#b8873b',
    '#9c6f2a',
    '#835b20',
    '#664515',
];

// Rosewood — guests, romantic accents
const blush: MantineColorsTuple = [
    '#fdf0f3',
    '#f7dbe2',
    '#efb8c5',
    '#e493a7',
    '#d9738d',
    '#cc5f7b',
    '#b24f66',
    '#963f55',
    '#7d3346',
    '#622636',
];

// Deep wine — dark surfaces
const wine: MantineColorsTuple = [
    '#fbf0f2',
    '#f0d8dd',
    '#dfb0ba',
    '#c98594',
    '#b46274',
    '#9d4a5d',
    '#7d3546',
    '#5e2836',
    '#4a1f2b',
    '#2b141b',
];

// Sage — secondary / "save" accent
const sage: MantineColorsTuple = [
    '#f2f6ef',
    '#e4ebdf',
    '#c6d5bb',
    '#a6be94',
    '#8baa73',
    '#7a9d5e',
    '#719753',
    '#5f8343',
    '#537439',
    '#44642c',
];

const serif = "'Cormorant Garamond', 'Noto Serif Armenian', Georgia, serif";
const sans = "'Montserrat', 'Noto Sans Armenian', 'Segoe UI', sans-serif";

export const theme = createTheme({
    primaryColor: 'gold',
    primaryShade: 6,
    colors: { gold, blush, sage, wine },
    fontFamily: sans,
    headings: { fontFamily: serif, fontWeight: '600' },
    defaultRadius: 'md',
    black: '#2f2224',
    components: {
        Button: { defaultProps: { radius: 'xl' } },
        Tooltip: { defaultProps: { withArrow: true, openDelay: 250, color: 'wine.9' } },
        Modal: { defaultProps: { centered: true, radius: 'lg', overlayProps: { blur: 3, backgroundOpacity: 0.35 } } },
    },
});
