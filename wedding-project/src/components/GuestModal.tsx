import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconArmchair, IconTrash, IconUserOff } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { HallData, MealKind, MEALS } from '../types/types.ts';
import { HallStore } from '../hooks/useHallStore.ts';
import { isSeated, seatIndex, seatKey } from '../utils/guests.ts';
import { headRoleKey } from '../utils/chairs.ts';
import { Flourish } from './Illustrations';

export type GuestTarget = { kind: 'seat'; tableId: number; seat: number } | { kind: 'guest'; guestId: string };

interface GuestModalProps {
    target: GuestTarget | null;
    hall: HallData;
    store: HallStore;
    tableLabelFor: (tableId: number) => string;
    onClose: () => void;
}

const NOT_SEATED = '';

/** One dialog for everything about a guest: name, group, meal, note and seat. */
function GuestModal({ target, hall, store, tableLabelFor, onClose }: GuestModalProps) {
    const { t } = useTranslation();
    const seats = useMemo(() => seatIndex(hall.guests), [hall.guests]);

    const guest =
        target?.kind === 'guest'
            ? hall.guests.find(g => g.id === target.guestId)
            : target?.kind === 'seat'
              ? seats.get(seatKey(target.tableId, target.seat))
              : undefined;

    const [name, setName] = useState('');
    const [groupId, setGroupId] = useState<string | null>(null);
    const [meal, setMeal] = useState<MealKind>('standard');
    const [note, setNote] = useState('');
    const [tableId, setTableId] = useState<string>(NOT_SEATED);
    const [seat, setSeat] = useState<string | null>(null);
    const [pickedId, setPickedId] = useState<string | null>(null);

    // Reset the form whenever the dialog opens for another chair / guest
    const targetKey = target ? JSON.stringify(target) : '';
    useEffect(() => {
        if (!target) return;
        setName(guest?.name || '');
        setGroupId(guest?.groupId || null);
        setMeal(guest?.meal || 'standard');
        setNote(guest?.note || '');
        const seatTable = target.kind === 'seat' ? target.tableId : guest?.tableId;
        const seatIndexValue = target.kind === 'seat' ? target.seat : guest?.seat;
        setTableId(seatTable !== undefined ? String(seatTable) : NOT_SEATED);
        setSeat(seatIndexValue !== undefined ? String(seatIndexValue) : null);
        setPickedId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetKey]);

    const unseated = hall.guests.filter(g => !isSeated(g));
    const emptySeat = target?.kind === 'seat' && !guest;

    const selectedTable = hall.tables.find(table => String(table.id) === tableId);
    const freeSeatOptions = selectedTable
        ? Array.from({ length: selectedTable.capacity }, (_, i) => i)
              .filter(i => {
                  const occupant = seats.get(seatKey(selectedTable.id, i));
                  return !occupant || occupant.id === guest?.id;
              })
              .map(i => {
                  const role = headRoleKey(selectedTable, i);
                  return { value: String(i), label: role ? `${i + 1} · ${t(role)}` : `${t('seat')} ${i + 1}` };
              })
        : [];

    const tableOptions = [
        { value: NOT_SEATED, label: t('not_seated') },
        ...hall.tables.map(table => {
            const taken = Array.from({ length: table.capacity }, (_, i) => seats.get(seatKey(table.id, i))).filter(
                occupant => occupant && occupant.id !== guest?.id,
            ).length;
            return {
                value: String(table.id),
                label: `${tableLabelFor(table.id)} (${table.capacity - taken} ${t('free')})`,
                disabled: taken >= table.capacity,
            };
        }),
    ];

    const roleTitle =
        target?.kind === 'seat'
            ? (() => {
                  const table = hall.tables.find(tbl => tbl.id === target.tableId);
                  const role = table && headRoleKey(table, target.seat);
                  return role ? t(role) : t('edit_guest', { n: target.seat + 1 });
              })()
            : guest
              ? t('edit_guest_title')
              : '';

    const subtitle =
        target?.kind === 'seat' ? tableLabelFor(target.tableId) : guest && isSeated(guest) ? `${tableLabelFor(guest.tableId!)} · ${t('seat')} ${guest.seat! + 1}` : t('not_seated');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        const fields = {
            name: trimmed,
            groupId: groupId || undefined,
            meal: meal === 'standard' ? undefined : meal,
            note: note.trim() || undefined,
        };

        if (emptySeat && target?.kind === 'seat') {
            // Picked an existing guest from the list (or typed exactly their name)
            const existing =
                (pickedId && hall.guests.find(g => g.id === pickedId)) ||
                unseated.find(g => g.name.toLowerCase() === trimmed.toLowerCase());
            if (existing) {
                store.updateGuest(existing.id, fields);
                store.seatGuest(existing.id, target.tableId, target.seat);
            } else {
                store.addGuests([{ ...fields, tableId: target.tableId, seat: target.seat }]);
            }
        } else if (guest) {
            store.updateGuest(guest.id, fields);
            if (target?.kind === 'guest') {
                if (tableId === NOT_SEATED) {
                    if (isSeated(guest)) store.unseatGuest(guest.id);
                } else if (seat !== null && (String(guest.tableId) !== tableId || String(guest.seat) !== seat)) {
                    store.seatGuest(guest.id, Number(tableId), Number(seat));
                }
            }
        }
        onClose();
    };

    return (
        <Modal
            opened={!!target}
            onClose={onClose}
            size="md"
            title={
                <Stack gap={2}>
                    <Text className="modal-title">{roleTitle}</Text>
                    <Text size="xs" c="dimmed">{subtitle}</Text>
                </Stack>
            }
        >
            <form onSubmit={submit}>
                <Stack gap="sm">
                    <Flourish width={140} className="modal-flourish" />
                    {emptySeat ? (
                        <Autocomplete
                            data-autofocus
                            label={t('guest_name_label')}
                            description={unseated.length ? t('pick_or_type', { count: unseated.length }) : undefined}
                            placeholder={t('guest_name_placeholder')}
                            value={name}
                            onChange={value => {
                                setName(value);
                                setPickedId(null);
                            }}
                            data={[...new Set(unseated.map(g => g.name))]}
                            onOptionSubmit={value => {
                                const picked = unseated.find(g => g.name === value);
                                if (!picked) return;
                                setPickedId(picked.id);
                                setGroupId(picked.groupId || null);
                                setMeal(picked.meal || 'standard');
                                setNote(picked.note || '');
                            }}
                            limit={30}
                            maxDropdownHeight={260}
                            comboboxProps={{ withinPortal: true }}
                        />
                    ) : (
                        <TextInput
                            data-autofocus
                            label={t('guest_name_label')}
                            placeholder={t('guest_name_placeholder')}
                            value={name}
                            onChange={e => setName(e.currentTarget.value)}
                        />
                    )}

                    <SimpleGrid cols={2} spacing="sm">
                        <Select
                            label={t('group')}
                            placeholder={t('no_group')}
                            data={hall.groups.map(group => ({ value: group.id, label: group.name }))}
                            value={groupId}
                            onChange={setGroupId}
                            clearable
                        />
                        <Select
                            label={t('meal')}
                            data={MEALS.map(value => ({ value, label: t(`meal_${value}`) }))}
                            value={meal}
                            onChange={value => setMeal((value as MealKind) || 'standard')}
                            allowDeselect={false}
                        />
                    </SimpleGrid>
                    <TextInput
                        label={t('note')}
                        placeholder={t('note_placeholder')}
                        value={note}
                        onChange={e => setNote(e.currentTarget.value)}
                    />

                    {target?.kind === 'guest' && guest && (
                        <SimpleGrid cols={2} spacing="sm">
                            <Select
                                label={t('table')}
                                leftSection={<IconArmchair size={15} />}
                                data={tableOptions}
                                value={tableId}
                                onChange={value => {
                                    setTableId(value ?? NOT_SEATED);
                                    const table = hall.tables.find(tbl => String(tbl.id) === value);
                                    const first = table
                                        ? Array.from({ length: table.capacity }, (_, i) => i).find(i => {
                                              const occupant = seats.get(seatKey(table.id, i));
                                              return !occupant || occupant.id === guest.id;
                                          })
                                        : undefined;
                                    setSeat(first !== undefined ? String(first) : null);
                                }}
                                allowDeselect={false}
                                searchable
                            />
                            <Select
                                label={t('seat')}
                                data={freeSeatOptions}
                                value={seat}
                                onChange={setSeat}
                                disabled={tableId === NOT_SEATED}
                                allowDeselect={false}
                            />
                        </SimpleGrid>
                    )}

                    <Group justify="space-between" mt="xs">
                        <Group gap={4}>
                            {guest && isSeated(guest) && (
                                <Button
                                    variant="subtle"
                                    color="gray"
                                    leftSection={<IconUserOff size={15} />}
                                    onClick={() => {
                                        store.unseatGuest(guest.id);
                                        onClose();
                                    }}
                                >
                                    {t('remove_guest')}
                                </Button>
                            )}
                            {guest && (
                                <Button
                                    variant="subtle"
                                    color="red"
                                    leftSection={<IconTrash size={15} />}
                                    onClick={() => {
                                        store.deleteGuest(guest.id);
                                        onClose();
                                    }}
                                >
                                    {t('delete_guest')}
                                </Button>
                            )}
                        </Group>
                        <Group gap="xs">
                            <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                            <Button type="submit" disabled={!name.trim()}>{t('btn_save')}</Button>
                        </Group>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}

export default GuestModal;
