import { useTranslation } from 'react-i18next';
import {
    ActionIcon,
    Box,
    Button,
    ColorInput,
    Group,
    Image,
    Menu,
    NumberInput,
    Paper,
    Progress,
    ScrollArea,
    SegmentedControl,
    SimpleGrid,
    Stack,
    Tabs,
    Text,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import {
    IconAlertTriangle,
    IconArrowLeft,
    IconBuildingCastle,
    IconCalendarEvent,
    IconCheck,
    IconCloudCheck,
    IconCloudOff,
    IconCrown,
    IconDeviceFloppy,
    IconLanguage,
    IconLayoutColumns,
    IconLayoutGrid,
    IconLayoutRows,
    IconLoader2,
    IconPencil,
    IconPhoto,
    IconPlus,
    IconRefresh,
    IconSparkles,
    IconTable,
    IconTemplate,
    IconTrash,
    IconUsersGroup,
} from '@tabler/icons-react';
import { ElementKind, Gradient, HallData, TableShapeKind, Venue } from '../types/types.ts';
import { LoadStatus } from '../hooks/useHallStore.ts';
import { usePersistentState } from '../hooks/usePersistentState.ts';
import { LayoutOrientation } from '../utils/seating.ts';
import { ELEMENT_KINDS, elementLabelKey } from '../utils/elements.ts';
import { isSeated } from '../utils/guests.ts';
import { formatDate } from '../utils/labels.ts';
import { RectTableIcon, RingsWreath, RoundTableIcon } from './Illustrations';
import { ElementIcon } from './ElementIcon';
import LanguageSwitch from './LanguageSwitch';
import { changeAppLanguage } from '../i18n';

const DEFAULT_GRADIENT: Gradient = { color1: '#F3EFEA', color2: '#E6DCC8' };
const nonEmpty = (gradient: Gradient): Partial<Gradient> =>
    Object.fromEntries(Object.entries(gradient).filter(([, value]) => value));

type SidebarTab = 'tables' | 'hall';
const isTab = (value: unknown): value is SidebarTab => value === 'tables' || value === 'hall';

const LANGUAGES = [
    { value: 'am', short: 'ՀԱՅ', label: 'Հայերեն' },
    { value: 'ru', short: 'РУС', label: 'Русский' },
    { value: 'en', short: 'ENG', label: 'English' },
];

interface SidebarProps {
    mode: 'venue' | 'couple';
    event: { title: string; date: string };
    venue: Venue | null;
    hall: HallData;
    onBack?: () => void;
    onEditEvent?: () => void;
    onSaveTemplate?: () => void;
    addCount: number;
    setAddCount: (value: number) => void;
    selectedShape: TableShapeKind;
    setSelectedShape: (shape: TableShapeKind) => void;
    addTables: () => void;
    addElement: (kind: ElementKind) => void;
    isHeadTable: boolean;
    setIsHeadTable: (value: boolean) => void;
    deleteAllTables: () => void;
    onBgGradientChange: (key: 'color1' | 'color2', value: string) => void;
    onBgGradientSet: (value: Gradient) => void;
    onBgGradientReset: () => void;
    onSaveToServer: () => void;
    isSaving: boolean;
    isDirty: boolean;
    loadStatus: LoadStatus;
    onOpenPlanner: () => void;
    onArrange: () => void;
    orientation: LayoutOrientation;
    onOrientationChange: (orientation: LayoutOrientation) => void;
}

// Soft wedding palettes for the hall background (center → edges)
const BG_PRESETS: { key: string; color1: string; color2: string }[] = [
    { key: 'bg_champagne', color1: '#FFFDF8', color2: '#E9D8BC' },
    { key: 'bg_blush', color1: '#FFF8F7', color2: '#EBC8CB' },
    { key: 'bg_sage', color1: '#FAFCF6', color2: '#CAD8BD' },
    { key: 'bg_lavender', color1: '#FCFAFE', color2: '#D8CDE6' },
];

const SWATCHES = ['#FFFDF8', '#F3EBDD', '#E9D8BC', '#E6CB95', '#EBC8CB', '#C98F96', '#CAD8BD', '#9CAF88', '#D8CDE6', '#3F3230'];

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" style={{ letterSpacing: 1.2 }}>
            {children}
        </Text>
    );
}

function Sidebar({
    mode,
    event,
    venue,
    hall,
    onBack,
    onEditEvent,
    onSaveTemplate,
    addCount,
    setAddCount,
    selectedShape,
    setSelectedShape,
    addTables,
    addElement,
    isHeadTable,
    setIsHeadTable,
    deleteAllTables,
    onBgGradientChange,
    onBgGradientSet,
    onBgGradientReset,
    onSaveToServer,
    isSaving,
    isDirty,
    loadStatus,
    onOpenPlanner,
    onArrange,
    orientation,
    onOrientationChange,
}: SidebarProps) {
    const { t, i18n } = useTranslation();
    const [tab, setTab] = usePersistentState<SidebarTab>('sidebar-tab', 'tables', isTab);
    const { tables, bgGradients } = hall;
    const isVenue = mode === 'venue';

    const hasHeadTable = tables.some(table => table.isHeadTable);
    const totalSeats = tables.reduce((sum, table) => sum + (table.capacity || 0), 0);
    const seatedGuests = hall.guests.filter(isSeated).length;
    const fillPercent = totalSeats ? Math.round((seatedGuests / totalSeats) * 100) : 0;
    const isPhotoBg = !bgGradients.color1 || !bgGradients.color2;
    const saveState =
        loadStatus === 'conflict'
            ? 'conflict'
            : loadStatus === 'offline'
              ? 'offline'
              : isSaving
                ? 'saving'
                : isDirty
                  ? 'dirty'
                  : loadStatus === 'loading'
                    ? 'loading'
                    : 'saved';
    const SaveIcon =
        saveState === 'offline'
            ? IconCloudOff
            : saveState === 'conflict'
              ? IconAlertTriangle
              : saveState === 'saving' || saveState === 'loading'
                ? IconLoader2
                : saveState === 'dirty'
                  ? IconDeviceFloppy
                  : IconCloudCheck;

    // Picking one colour while the floor image is active starts a gradient with a sensible partner colour
    const changeColor = (key: keyof Gradient, value: string) => {
        if (isPhotoBg) onBgGradientSet({ ...DEFAULT_GRADIENT, ...nonEmpty(bgGradients), [key]: value });
        else onBgGradientChange(key, value);
    };

    // ---- Header: always visible ----------------------------------------------------
    const header = (
        <Stack gap={10} className="sidebar-header">
            <Group justify="space-between" wrap="nowrap" gap={6}>
                {onBack ? (
                    <Tooltip label={t('all_events')} position="bottom">
                        <ActionIcon variant="subtle" color="gold.2" radius="xl" onClick={onBack} aria-label={t('all_events')}>
                            <IconArrowLeft size={17} />
                        </ActionIcon>
                    </Tooltip>
                ) : (
                    <span />
                )}
                <Group gap={4} wrap="nowrap">
                    <Tooltip label={`${t(`save_state_${saveState}`)} · ${t('click_to_save')}`} position="bottom">
                        <UnstyledButton className={`save-pill ${saveState}`} onClick={onSaveToServer} aria-label={t('btn_save_server')}>
                            <SaveIcon size={14} className={saveState === 'saving' ? 'spin' : undefined} />
                            <span>{t(`save_short_${saveState}`)}</span>
                        </UnstyledButton>
                    </Tooltip>
                    <Menu position="bottom-end" withinPortal shadow="md">
                        <Menu.Target>
                            <UnstyledButton className="lang-pill" aria-label={t('section_language')} title={t('section_language')}>
                                <IconLanguage size={14} />
                                <span>{LANGUAGES.find(lang => i18n.language?.startsWith(lang.value))?.short || 'ՀԱՅ'}</span>
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {LANGUAGES.map(lang => (
                                <Menu.Item
                                    key={lang.value}
                                    onClick={() => changeAppLanguage(lang.value)}
                                    rightSection={i18n.language?.startsWith(lang.value) ? <IconCheck size={14} /> : undefined}
                                >
                                    {lang.label}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>

            <Group gap="sm" wrap="nowrap" align="center">
                <div className="sidebar-logo-box">
                    {venue?.logo ? <Image src={venue.logo} alt="" fit="contain" h={44} w={44} /> : <RingsWreath size={48} />}
                </div>
                <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    {venue?.name && (
                        <Text size="10px" tt="uppercase" fw={700} c="gold.3" truncate style={{ letterSpacing: 1.6 }}>
                            {venue.name}
                        </Text>
                    )}
                    <Group gap={2} wrap="nowrap">
                        <Text className="sidebar-title" truncate>
                            {event.title || t('sidebar_title')}
                        </Text>
                        {onEditEvent && (
                            <ActionIcon variant="subtle" color="gold.3" size="sm" onClick={onEditEvent} aria-label={t('edit_event')} title={t('edit_event')}>
                                <IconPencil size={13} />
                            </ActionIcon>
                        )}
                    </Group>
                    {event.date && (
                        <Group gap={4} c="dimmed" wrap="nowrap">
                            <IconCalendarEvent size={12} />
                            <Text size="xs">{formatDate(event.date, i18n.language)}</Text>
                        </Group>
                    )}
                </Stack>
            </Group>

            <Box className="stats-strip">
                <Group justify="space-between" wrap="nowrap" gap={4}>
                    {[
                        { value: tables.length, label: t('stats_tables') },
                        { value: totalSeats, label: t('stats_seats') },
                        { value: `${seatedGuests}/${hall.guests.length}`, label: t('stats_guests') },
                    ].map(stat => (
                        <Group key={stat.label} gap={5} wrap="nowrap" align="baseline">
                            <Text className="stat-value">{stat.value}</Text>
                            <Text size="10px" c="dimmed" tt="uppercase" fw={600}>{stat.label}</Text>
                        </Group>
                    ))}
                </Group>
                <Tooltip label={t('seats_filled', { percent: fillPercent })}>
                    <Progress value={fillPercent} size={4} radius="xl" color="blush.3" mt={6} className="stats-progress" />
                </Tooltip>
            </Box>
        </Stack>
    );

    // ---- Couple: just the welcome text ------------------------------------------------
    if (!isVenue) {
        return (
            <Box className="sidebar">
                <ScrollArea h="100%" type="hover" scrollbarSize={6}>
                    <Stack gap="md" p="md">
                        {header}
                        <Paper className="smart-card" radius="lg" p="sm">
                            <Text size="sm">{t('couple_intro')}</Text>
                        </Paper>
                        <Group gap={6} c="dimmed">
                            <IconLanguage size={14} />
                            <LanguageSwitch />
                        </Group>
                    </Stack>
                </ScrollArea>
            </Box>
        );
    }

    return (
        <Box className="sidebar">
            <div className="sidebar-layout">
                <Box p="md" pb={0}>{header}</Box>

                <Tabs value={tab} onChange={value => isTab(value) && setTab(value)} variant="pills" radius="xl" className="sidebar-tabs">
                    <Tabs.List grow px="md" pt="sm">
                        <Tabs.Tab value="tables" leftSection={<IconTable size={15} />}>{t('tab_tables')}</Tabs.Tab>
                        <Tabs.Tab value="hall" leftSection={<IconBuildingCastle size={15} />}>{t('tab_hall')}</Tabs.Tab>
                    </Tabs.List>

                    <ScrollArea className="sidebar-tab-scroll" type="hover" scrollbarSize={6}>
                        {/* ---- Tables ---- */}
                        <Tabs.Panel value="tables">
                            <Stack gap="md" p="md">
                                <Paper className="smart-card" radius="lg" p="sm">
                                    <Stack gap="xs">
                                        <Group gap={6}>
                                            <IconSparkles size={15} color="var(--mantine-color-blush-2)" />
                                            <Text size="xs" fw={700} tt="uppercase" c="blush.2" style={{ letterSpacing: 1.2 }}>
                                                {t('section_smart')}
                                            </Text>
                                        </Group>
                                        <Button
                                            fullWidth
                                            variant="gradient"
                                            gradient={{ from: 'blush.5', to: 'blush.8', deg: 135 }}
                                            leftSection={<IconUsersGroup size={17} />}
                                            onClick={onOpenPlanner}
                                        >
                                            {t('btn_plan_guests')}
                                        </Button>
                                        <Group gap={6} wrap="nowrap">
                                            <SegmentedControl
                                                size="xs"
                                                radius="xl"
                                                value={orientation}
                                                onChange={value => onOrientationChange(value as LayoutOrientation)}
                                                data={[
                                                    { value: 'horizontal', label: <Tooltip label={t('layout_horizontal')}><IconLayoutRows size={15} /></Tooltip> },
                                                    { value: 'vertical', label: <Tooltip label={t('layout_vertical')}><IconLayoutColumns size={15} /></Tooltip> },
                                                ]}
                                            />
                                            <Button
                                                flex={1}
                                                size="xs"
                                                variant="outline"
                                                color="blush.2"
                                                leftSection={<IconLayoutGrid size={15} />}
                                                onClick={onArrange}
                                                disabled={tables.length === 0}
                                            >
                                                {t('btn_arrange')}
                                            </Button>
                                        </Group>
                                    </Stack>
                                </Paper>

                                <Stack gap="xs">
                                    <SectionLabel>{t('section_add')}</SectionLabel>
                                    <SimpleGrid cols={3} spacing={6}>
                                        {[
                                            { value: 'round' as const, label: t('shape_round'), icon: <RoundTableIcon size={30} /> },
                                            { value: 'rect' as const, label: t('shape_rect'), icon: <RectTableIcon size={30} /> },
                                        ].map(option => (
                                            <UnstyledButton
                                                key={option.value}
                                                className={`shape-option ${selectedShape === option.value && !isHeadTable ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedShape(option.value);
                                                    setIsHeadTable(false);
                                                }}
                                            >
                                                {option.icon}
                                                <Text size="10px" fw={600}>{option.label}</Text>
                                            </UnstyledButton>
                                        ))}
                                        <Tooltip label={hasHeadTable ? t('head_table_exist') : t('head_table_hint')} multiline maw={220}>
                                            <UnstyledButton
                                                className={`shape-option ${isHeadTable ? 'selected' : ''}`}
                                                onClick={() => setIsHeadTable(!isHeadTable)}
                                                disabled={hasHeadTable}
                                            >
                                                <IconCrown size={26} color="var(--mantine-color-gold-3)" />
                                                <Text size="10px" fw={600}>{t('head_table')}</Text>
                                            </UnstyledButton>
                                        </Tooltip>
                                    </SimpleGrid>
                                    <Group gap="xs" wrap="nowrap">
                                        <NumberInput
                                            size="sm"
                                            min={1}
                                            max={50}
                                            clampBehavior="strict"
                                            allowDecimal={false}
                                            allowNegative={false}
                                            value={isHeadTable ? 1 : addCount}
                                            onChange={value => setAddCount(Math.max(1, Number(value) || 1))}
                                            disabled={isHeadTable}
                                            w={80}
                                            aria-label={t('add_tables_count')}
                                        />
                                        <Button
                                            flex={1}
                                            leftSection={<IconPlus size={16} />}
                                            onClick={addTables}
                                            variant="gradient"
                                            gradient={{ from: 'gold.4', to: 'gold.7', deg: 135 }}
                                        >
                                            {t('btn_add_tables')}
                                        </Button>
                                    </Group>
                                </Stack>
                            </Stack>
                        </Tabs.Panel>

                        {/* ---- Hall ---- */}
                        <Tabs.Panel value="hall">
                            <Stack gap="md" p="md">
                                <Stack gap="xs">
                                    <SectionLabel>{t('section_elements')}</SectionLabel>
                                    <SimpleGrid cols={3} spacing={6}>
                                        {ELEMENT_KINDS.map(kind => (
                                            <UnstyledButton key={kind} className="shape-option element-option" onClick={() => addElement(kind)}>
                                                <ElementIcon kind={kind} size={20} />
                                                <Text size="10px" fw={600} lh={1.15} ta="center">{t(elementLabelKey(kind))}</Text>
                                            </UnstyledButton>
                                        ))}
                                    </SimpleGrid>
                                    <Text size="11px" c="dimmed">{t('elements_hint')}</Text>
                                </Stack>

                                <Stack gap="xs">
                                    <SectionLabel>{t('section_background')}</SectionLabel>
                                    <SimpleGrid cols={5} spacing={6}>
                                        <Tooltip label={t('bg_photo')}>
                                            <UnstyledButton
                                                className={`bg-preset photo ${isPhotoBg ? 'selected' : ''}`}
                                                onClick={onBgGradientReset}
                                                aria-label={t('bg_photo')}
                                            >
                                                <IconPhoto size={16} />
                                            </UnstyledButton>
                                        </Tooltip>
                                        {BG_PRESETS.map(preset => {
                                            const selected =
                                                bgGradients.color1.toLowerCase() === preset.color1.toLowerCase() &&
                                                bgGradients.color2.toLowerCase() === preset.color2.toLowerCase();
                                            return (
                                                <Tooltip key={preset.key} label={t(preset.key)}>
                                                    <UnstyledButton
                                                        className={`bg-preset ${selected ? 'selected' : ''}`}
                                                        style={{ background: `radial-gradient(circle, ${preset.color1} 15%, ${preset.color2} 100%)` }}
                                                        onClick={() => onBgGradientSet({ color1: preset.color1, color2: preset.color2 })}
                                                        aria-label={t(preset.key)}
                                                    />
                                                </Tooltip>
                                            );
                                        })}
                                    </SimpleGrid>
                                    <SimpleGrid cols={2} spacing="xs">
                                        <ColorInput
                                            size="xs"
                                            label={t('color_center')}
                                            value={bgGradients.color1 || DEFAULT_GRADIENT.color1}
                                            onChange={value => changeColor('color1', value)}
                                            swatches={SWATCHES}
                                            swatchesPerRow={5}
                                        />
                                        <ColorInput
                                            size="xs"
                                            label={t('color_edges')}
                                            value={bgGradients.color2 || DEFAULT_GRADIENT.color2}
                                            onChange={value => changeColor('color2', value)}
                                            swatches={SWATCHES}
                                            swatchesPerRow={5}
                                        />
                                    </SimpleGrid>
                                    {!isPhotoBg && (
                                        <Button size="xs" variant="subtle" color="gold.2" leftSection={<IconRefresh size={14} />} onClick={onBgGradientReset}>
                                            {t('btn_reset_bg')}
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </Tabs.Panel>
                    </ScrollArea>
                </Tabs>

                {/* Footer: shared by both tabs */}
                <Group className="sidebar-footer" gap={6} wrap="nowrap" justify="space-between">
                    {onSaveTemplate && (
                        <Tooltip label={t('template_name_hint')} multiline maw={240}>
                            <Button
                                size="xs"
                                variant="light"
                                color="gold.3"
                                leftSection={<IconTemplate size={15} />}
                                onClick={onSaveTemplate}
                                disabled={tables.length === 0}
                            >
                                {t('btn_save_template_short')}
                            </Button>
                        </Tooltip>
                    )}
                    <Button
                        size="xs"
                        variant="subtle"
                        color="red.3"
                        leftSection={<IconTrash size={14} />}
                        onClick={deleteAllTables}
                        disabled={tables.length === 0}
                        className="sidebar-danger"
                    >
                        {t('btn_delete_all')}
                    </Button>
                </Group>
            </div>
        </Box>
    );
}

export default Sidebar;
