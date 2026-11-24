import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Badge,
    Box,
    Button,
    Checkbox,
    Group,
    Modal,
    NumberInput,
    Paper,
    SimpleGrid,
    Stack,
    Switch,
    Text,
    UnstyledButton,
} from '@mantine/core';
import { IconAlertTriangle, IconCrown, IconSparkles, IconUsers } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { TableData } from '../types/types.ts';
import { buildTables, planSeating, summarize, TableShape } from '../utils/seating.ts';
import { nextTableIds } from '../hooks/useHallStore.ts';
import { HEAD_ROLES, HEAD_SEATS, isCoupleSeat } from '../utils/chairs.ts';
import { Flourish, RectTableIcon, RoundTableIcon } from './Illustrations';

interface PlannerModalProps {
    opened: boolean;
    onClose: () => void;
    existingTables: TableData[];
    /** Guests currently sitting at a table (they keep their names but stand up on replace). */
    seatedGuests: number;
    /** Size of the guest list, used as the starting number. */
    defaultGuests: number;
    onCreate: (tables: TableData[], replace: boolean) => void;
}

function MixedTableIcon() {
    return (
        <Group gap={0} wrap="nowrap">
            <RoundTableIcon size={24} />
            <RectTableIcon size={24} />
        </Group>
    );
}

function PlannerModal({ opened, onClose, existingTables, seatedGuests, defaultGuests, onCreate }: PlannerModalProps) {
    const { t } = useTranslation();
    const [guests, setGuests] = useState<number>(defaultGuests);
    useEffect(() => {
        if (opened) setGuests(defaultGuests);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened]);
    const [perTable, setPerTable] = useState<number>(12);
    const [maxPerTable, setMaxPerTable] = useState<number>(14);
    const [shape, setShape] = useState<TableShape>('round');
    const [includeHead, setIncludeHead] = useState(true);
    const [replace, setReplace] = useState(true);

    const hasTables = existingTables.length > 0;
    const existingHead = existingTables.some(table => table.isHeadTable);
    const assignedGuests = seatedGuests;

    // A head table can only be added if none will remain in the hall
    const headBlocked = existingHead && !replace && hasTables;
    const willAddHead = includeHead && !headBlocked;

    const plan = useMemo(
        () => planSeating(guests || 0, perTable || 12, Math.max(perTable || 12, maxPerTable || 0), willAddHead ? HEAD_SEATS : 0),
        [guests, perTable, maxPerTable, willAddHead],
    );
    const groups = summarize(plan.capacities);
    const totalSeats = plan.capacities.reduce((a, b) => a + b, 0) + (willAddHead ? plan.headSeats : 0);

    const shapes: { value: TableShape; label: string; icon: React.ReactNode }[] = [
        { value: 'round', label: t('shape_round'), icon: <RoundTableIcon size={30} /> },
        { value: 'rect', label: t('shape_rect'), icon: <RectTableIcon size={30} /> },
        { value: 'mixed', label: t('shape_mixed'), icon: <MixedTableIcon /> },
    ];

    const submit = () => {
        const idCount = plan.capacities.length + (willAddHead ? 1 : 0);
        const tables = buildTables(plan, shape, willAddHead, nextTableIds(existingTables, idCount)[0]);
        onCreate(tables, hasTables ? replace : true);
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="lg"
            title={
                <Stack gap={2}>
                    <Text className="modal-title">{t('planner_title')}</Text>
                    <Text size="xs" c="dimmed">{t('planner_subtitle')}</Text>
                </Stack>
            }
        >
            <Stack gap="md">
                <Flourish width={160} className="modal-flourish" />

                <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
                    <NumberInput
                        label={t('guests_count')}
                        leftSection={<IconUsers size={16} />}
                        min={1}
                        max={3000}
                        allowDecimal={false}
                        allowNegative={false}
                        value={guests}
                        onChange={value => setGuests(Number(value) || 0)}
                        size="md"
                        data-autofocus
                    />
                    <NumberInput
                        label={t('seats_per_table')}
                        min={4}
                        max={20}
                        allowDecimal={false}
                        allowNegative={false}
                        clampBehavior="strict"
                        value={perTable}
                        onChange={value => {
                            const next = Number(value) || 12;
                            setPerTable(next);
                            if (maxPerTable < next) setMaxPerTable(next);
                        }}
                        size="md"
                    />
                    <NumberInput
                        label={t('seats_max')}
                        min={perTable}
                        max={24}
                        allowDecimal={false}
                        allowNegative={false}
                        clampBehavior="blur"
                        value={maxPerTable}
                        onChange={value => setMaxPerTable(Number(value) || perTable)}
                        size="md"
                    />
                </SimpleGrid>
                <Text size="xs" c="dimmed" mt={-8}>{t('seats_hint', { std: perTable, max: Math.max(perTable, maxPerTable) })}</Text>

                <Box>
                    <Text size="sm" fw={500} mb={6}>{t('table_shape')}</Text>
                    <SimpleGrid cols={3} spacing="xs">
                        {shapes.map(option => (
                            <UnstyledButton
                                key={option.value}
                                className={`shape-option ${shape === option.value ? 'selected' : ''}`}
                                onClick={() => setShape(option.value)}
                            >
                                {option.icon}
                                <Text size="xs" fw={600}>{option.label}</Text>
                            </UnstyledButton>
                        ))}
                    </SimpleGrid>
                </Box>

                <Paper className={`head-toggle ${willAddHead ? 'active' : ''}`} radius="md" p="sm">
                    <Stack gap={8}>
                        <Switch
                            checked={includeHead && !headBlocked}
                            disabled={headBlocked}
                            onChange={e => setIncludeHead(e.currentTarget.checked)}
                            label={
                                <Group gap={6}>
                                    <IconCrown size={16} color="var(--gold)" />
                                    <Text size="sm" fw={600}>{t('include_head')}</Text>
                                </Group>
                            }
                            description={headBlocked ? t('head_already') : t('head_table_hint')}
                        />
                        {willAddHead && (
                            <Group gap={4}>
                                {HEAD_ROLES.map((role, i) => (
                                    <Badge key={role} size="sm" variant={isCoupleSeat(i) ? 'filled' : 'light'} color={isCoupleSeat(i) ? 'blush' : 'gold'}>
                                        {t(role)}
                                    </Badge>
                                ))}
                            </Group>
                        )}
                    </Stack>
                </Paper>

                {hasTables && (
                    <Stack gap={6}>
                        <Checkbox
                            checked={replace}
                            onChange={e => setReplace(e.currentTarget.checked)}
                            label={t('replace_existing', { count: existingTables.length })}
                        />
                        {replace && assignedGuests > 0 && (
                            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} p="xs">
                                <Text size="xs">{t('replace_warning', { n: assignedGuests })}</Text>
                            </Alert>
                        )}
                    </Stack>
                )}

                {/* Live preview of the plan */}
                <Paper className="plan-preview" radius="lg" p="md">
                    <Group justify="space-between" mb="xs">
                        <Text className="plan-preview-count">
                            {t('preview_tables', { count: plan.capacities.length + (willAddHead ? 1 : 0) })}
                        </Text>
                        <Text size="xs" c="dimmed">
                            {t('preview_total', { seats: totalSeats, guests: guests || 0 })}
                        </Text>
                    </Group>
                    <Group gap={6}>
                        {willAddHead && (
                            <Badge color="gold" variant="filled" leftSection={<IconCrown size={12} />}>
                                1 × {plan.headSeats}
                            </Badge>
                        )}
                        {groups.map(([capacity, count]) => (
                            <Badge key={capacity} color="blush" variant="light" size="lg" radius="sm">
                                {count} × {capacity} {t('person')}
                            </Badge>
                        ))}
                    </Group>
                    {plan.capacities.length > 0 && (
                        <div className="plan-dots">
                            {plan.capacities.slice(0, 60).map((capacity, i) => (
                                <span
                                    key={i}
                                    className="plan-dot"
                                    style={{ width: 10 + capacity * 1.4, height: 10 + capacity * 1.4 }}
                                    title={`${capacity}`}
                                />
                            ))}
                            {plan.capacities.length > 60 && <Text size="xs" c="dimmed">+{plan.capacities.length - 60}</Text>}
                        </div>
                    )}
                </Paper>

                <Group justify="flex-end" gap="xs">
                    <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                    <Button
                        leftSection={<IconSparkles size={16} />}
                        variant="gradient"
                        gradient={{ from: 'gold.4', to: 'gold.7', deg: 135 }}
                        onClick={submit}
                        disabled={!guests || plan.capacities.length === 0 && !willAddHead}
                    >
                        {t('btn_create_arrange')}
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}

export default PlannerModal;
