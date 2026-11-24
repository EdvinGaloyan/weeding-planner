import { useMemo, useState } from 'react';
import {
    ActionIcon,
    Badge,
    Box,
    Button,
    ColorSwatch,
    Group,
    Menu,
    Popover,
    ScrollArea,
    SegmentedControl,
    Select,
    SimpleGrid,
    Stack,
    Tabs,
    Text,
    TextInput,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import {
    IconArmchair,
    IconDots,
    IconFileImport,
    IconGripVertical,
    IconPlus,
    IconSearch,
    IconSparkles,
    IconTrash,
    IconUserOff,
    IconUsers,
    IconX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import { Guest, HallData } from '../types/types.ts';
import { HallStore } from '../hooks/useHallStore.ts';
import { byName, GROUP_COLORS, isSeated, matchesQuery } from '../utils/guests.ts';
import { startGuestDrag } from '../utils/dnd.ts';
import { MealIcon } from './MealIcon';

interface GuestPanelProps {
    hall: HallData;
    store: HallStore;
    query: string;
    onQueryChange: (query: string) => void;
    tableLabelFor: (tableId: number) => string;
    onEditGuest: (guestId: string) => void;
    onOpenImport: () => void;
    onClose: () => void;
    /** Kept mounted while closed so it can slide in and out smoothly. */
    open: boolean;
}

type Filter = 'all' | 'unseated' | 'seated';

function GuestPanel({ hall, store, query, onQueryChange, tableLabelFor, onEditGuest, onOpenImport, onClose, open }: GuestPanelProps) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<Filter>('all');
    const [groupFilter, setGroupFilter] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newGroup, setNewGroup] = useState<string | null>(null);
    const [newGroupName, setNewGroupName] = useState('');

    const { guests, groups } = hall;
    const groupById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups]);
    const seatedCount = guests.filter(isSeated).length;
    const unseatedCount = guests.length - seatedCount;
    const freeSeats = hall.tables.filter(table => !table.isHeadTable).reduce((sum, table) => sum + table.capacity, 0) -
        guests.filter(guest => isSeated(guest) && !hall.tables.find(table => table.id === guest.tableId)?.isHeadTable).length;

    const visible = useMemo(
        () =>
            guests
                .filter(guest => matchesQuery(guest, query))
                .filter(guest => (filter === 'all' ? true : filter === 'seated' ? isSeated(guest) : !isSeated(guest)))
                .filter(guest => !groupFilter || (groupFilter === 'none' ? !guest.groupId : guest.groupId === groupFilter))
                .sort((a, b) => Number(isSeated(a)) - Number(isSeated(b)) || byName(a, b)),
        [guests, query, filter, groupFilter],
    );

    const groupOptions = groups.map(group => ({ value: group.id, label: group.name }));

    const addGuest = (e: React.FormEvent) => {
        e.preventDefault();
        const names = newName.split(/[,\n]/).map(name => name.trim()).filter(Boolean);
        if (!names.length) return;
        store.addGuests(names.map(name => ({ name, ...(newGroup ? { groupId: newGroup } : {}) })));
        setNewName('');
    };

    const confirm = (title: string, text: string, onConfirm: () => void) =>
        modals.openConfirmModal({
            title: <Text className="modal-title">{title}</Text>,
            children: <Text size="sm" c="dimmed">{text}</Text>,
            labels: { confirm: t('btn_confirm'), cancel: t('btn_cancel') },
            confirmProps: { color: 'red' },
            onConfirm,
        });

    const renderGuest = (guest: Guest) => {
        const group = guest.groupId ? groupById.get(guest.groupId) : undefined;
        const seated = isSeated(guest);
        return (
            <UnstyledButton
                key={guest.id}
                className={`guest-row ${seated ? 'seated' : 'unseated'}`}
                draggable
                onDragStart={e => startGuestDrag(e, guest.id)}
                onClick={() => onEditGuest(guest.id)}
            >
                <IconGripVertical size={14} className="guest-grip" />
                <span className="guest-dot" style={{ background: group?.color || 'transparent', borderColor: group?.color || '#c9b9a4' }} />
                <Box className="guest-main">
                    <Text size="sm" fw={600} className="guest-name" truncate>
                        {guest.name}
                    </Text>
                    {(group || guest.note) && (
                        <Text size="11px" c="dimmed" truncate>
                            {[group?.name, guest.note].filter(Boolean).join(' · ')}
                        </Text>
                    )}
                </Box>
                {guest.meal && guest.meal !== 'standard' && <MealIcon meal={guest.meal} size={15} />}
                {seated ? (
                    <Badge size="sm" variant="light" color="sage" className="guest-table-badge">
                        {tableLabelFor(guest.tableId!)} · {guest.seat! + 1}
                    </Badge>
                ) : (
                    <Badge size="sm" variant="outline" color="blush">{t('unseated_short')}</Badge>
                )}
            </UnstyledButton>
        );
    };

    return (
        <aside className={`guest-panel ${open ? '' : 'closed'}`} aria-hidden={!open}>
            <Group justify="space-between" className="guest-panel-header" wrap="nowrap">
                <Group gap={8} wrap="nowrap">
                    <IconUsers size={20} />
                    <Text className="guest-panel-title">{t('guests_title')}</Text>
                </Group>
                <ActionIcon variant="subtle" color="gray" onClick={onClose} aria-label={t('close')}>
                    <IconX size={18} />
                </ActionIcon>
            </Group>

            <SimpleGrid cols={3} spacing={6} px="md" pb="sm">
                {[
                    { value: guests.length, label: t('guests_total'), color: 'gold' },
                    { value: seatedCount, label: t('guests_seated'), color: 'sage' },
                    { value: unseatedCount, label: t('guests_unseated'), color: 'blush' },
                ].map(stat => (
                    <Box key={stat.label} className={`guest-stat ${stat.color}`}>
                        <Text className="guest-stat-value">{stat.value}</Text>
                        <Text size="10px" tt="uppercase" fw={700} c="dimmed">{stat.label}</Text>
                    </Box>
                ))}
            </SimpleGrid>

            <Tabs defaultValue="guests" color="blush" className="guest-tabs">
                <Tabs.List grow px="md">
                    <Tabs.Tab value="guests" leftSection={<IconUsers size={14} />}>{t('tab_guests')}</Tabs.Tab>
                    <Tabs.Tab value="groups" leftSection={<ColorSwatch color="#c2536d" size={10} />}>{t('tab_groups')}</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="guests" className="guest-tab-panel">
                    <Stack gap="xs" p="md" pb={6}>
                        <form onSubmit={addGuest}>
                            <Group gap={6} wrap="nowrap" align="flex-end">
                                <TextInput
                                    flex={1}
                                    size="sm"
                                    placeholder={t('add_guest_placeholder')}
                                    value={newName}
                                    onChange={e => setNewName(e.currentTarget.value)}
                                />
                                <Select
                                    w={110}
                                    size="sm"
                                    placeholder={t('group')}
                                    data={groupOptions}
                                    value={newGroup}
                                    onChange={setNewGroup}
                                    clearable
                                    comboboxProps={{ withinPortal: true }}
                                />
                                <ActionIcon type="submit" size="lg" variant="gradient" gradient={{ from: 'gold.4', to: 'gold.7', deg: 135 }} aria-label={t('btn_add')}>
                                    <IconPlus size={18} />
                                </ActionIcon>
                            </Group>
                        </form>

                        <Group gap={6} wrap="nowrap">
                            <Button flex={1} size="xs" variant="light" color="gold" leftSection={<IconFileImport size={14} />} onClick={onOpenImport}>
                                {t('btn_import')}
                            </Button>
                            <Tooltip label={unseatedCount && freeSeats <= 0 ? t('no_free_seats') : t('auto_seat_hint')} multiline maw={240}>
                                <Button
                                    flex={1}
                                    size="xs"
                                    variant="light"
                                    color="blush"
                                    leftSection={<IconSparkles size={14} />}
                                    disabled={!unseatedCount || freeSeats <= 0}
                                    onClick={store.autoSeat}
                                >
                                    {t('btn_auto_seat')}
                                </Button>
                            </Tooltip>
                            <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                    <ActionIcon variant="light" color="gray" size="md" aria-label={t('more')}>
                                        <IconDots size={16} />
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item
                                        leftSection={<IconUserOff size={14} />}
                                        disabled={!seatedCount}
                                        onClick={() => confirm(t('unseat_all_title'), t('unseat_all_text'), store.unseatAll)}
                                    >
                                        {t('unseat_all')}
                                    </Menu.Item>
                                    <Menu.Item
                                        color="red"
                                        leftSection={<IconTrash size={14} />}
                                        disabled={!guests.length}
                                        onClick={() =>
                                            confirm(t('delete_all_guests_title'), t('delete_all_guests_text', { count: guests.length }), () =>
                                                store.deleteGuests(guests.map(guest => guest.id)),
                                            )
                                        }
                                    >
                                        {t('delete_all_guests')}
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        </Group>

                        <TextInput
                            size="sm"
                            leftSection={<IconSearch size={15} />}
                            placeholder={t('search_guest')}
                            value={query}
                            onChange={e => onQueryChange(e.currentTarget.value)}
                            rightSection={
                                query ? (
                                    <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => onQueryChange('')} aria-label={t('clear')}>
                                        <IconX size={14} />
                                    </ActionIcon>
                                ) : undefined
                            }
                        />
                        <SegmentedControl
                            size="xs"
                            fullWidth
                            value={filter}
                            onChange={value => setFilter(value as Filter)}
                            data={[
                                { value: 'all', label: t('filter_all') },
                                { value: 'unseated', label: `${t('filter_unseated')} (${unseatedCount})` },
                                { value: 'seated', label: t('filter_seated') },
                            ]}
                        />
                        {groups.length > 0 && (
                            <Group gap={4}>
                                {groups.map(group => (
                                    <UnstyledButton
                                        key={group.id}
                                        className={`group-chip ${groupFilter === group.id ? 'active' : ''}`}
                                        style={{ '--chip-color': group.color } as React.CSSProperties}
                                        onClick={() => setGroupFilter(current => (current === group.id ? null : group.id))}
                                    >
                                        {group.name}
                                    </UnstyledButton>
                                ))}
                            </Group>
                        )}
                    </Stack>

                    <ScrollArea className="guest-list" type="auto" scrollbarSize={6}>
                        <Stack gap={4} px="md" pb="md">
                            {visible.map(renderGuest)}
                            {!visible.length && (
                                <Stack align="center" gap={6} py="xl" c="dimmed">
                                    <IconArmchair size={32} stroke={1.3} />
                                    <Text size="sm" ta="center" maw={240}>
                                        {guests.length ? t('no_guests_match') : t('no_guests_yet')}
                                    </Text>
                                </Stack>
                            )}
                        </Stack>
                    </ScrollArea>
                    <Text size="11px" c="dimmed" ta="center" px="md" pb="xs">{t('drag_hint')}</Text>
                </Tabs.Panel>

                <Tabs.Panel value="groups" className="guest-tab-panel">
                    <ScrollArea className="guest-list" type="auto" scrollbarSize={6}>
                        <Stack gap="xs" p="md">
                            {groups.map(group => {
                                const count = guests.filter(guest => guest.groupId === group.id).length;
                                return (
                                    <Group key={group.id} gap={8} wrap="nowrap" className="group-row">
                                        <Popover position="bottom-start" withinPortal shadow="md">
                                            <Popover.Target>
                                                <UnstyledButton aria-label={t('group_color')}>
                                                    <ColorSwatch color={group.color} size={26} />
                                                </UnstyledButton>
                                            </Popover.Target>
                                            <Popover.Dropdown>
                                                <SimpleGrid cols={4} spacing={6}>
                                                    {GROUP_COLORS.map(color => (
                                                        <UnstyledButton key={color} onClick={() => store.updateGroup(group.id, { color })}>
                                                            <ColorSwatch color={color} size={26} />
                                                        </UnstyledButton>
                                                    ))}
                                                </SimpleGrid>
                                            </Popover.Dropdown>
                                        </Popover>
                                        <TextInput
                                            flex={1}
                                            size="sm"
                                            defaultValue={group.name}
                                            key={group.name}
                                            onBlur={e => {
                                                const name = e.currentTarget.value.trim();
                                                if (name && name !== group.name) store.updateGroup(group.id, { name });
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                                        />
                                        <Badge variant="light" color="gray" size="sm">{count}</Badge>
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            onClick={() =>
                                                count
                                                    ? confirm(t('delete_group_title'), t('delete_group_text', { count }), () => store.deleteGroup(group.id))
                                                    : store.deleteGroup(group.id)
                                            }
                                            aria-label={t('btn_delete')}
                                        >
                                            <IconTrash size={15} />
                                        </ActionIcon>
                                    </Group>
                                );
                            })}
                            <form
                                onSubmit={e => {
                                    e.preventDefault();
                                    if (!newGroupName.trim()) return;
                                    store.addGroup(newGroupName, GROUP_COLORS[groups.length % GROUP_COLORS.length]);
                                    setNewGroupName('');
                                }}
                            >
                                <Group gap={6} wrap="nowrap" mt="xs">
                                    <TextInput
                                        flex={1}
                                        size="sm"
                                        placeholder={t('new_group_placeholder')}
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.currentTarget.value)}
                                    />
                                    <Button type="submit" size="sm" variant="light" color="gold" leftSection={<IconPlus size={14} />}>
                                        {t('btn_add')}
                                    </Button>
                                </Group>
                            </form>
                            <Text size="xs" c="dimmed">{t('groups_hint')}</Text>
                        </Stack>
                    </ScrollArea>
                </Tabs.Panel>
            </Tabs>
        </aside>
    );
}

export default GuestPanel;
