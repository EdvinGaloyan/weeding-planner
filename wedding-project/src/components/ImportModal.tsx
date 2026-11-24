import { useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, FileButton, Group, Modal, ScrollArea, Stack, Table, Text, Textarea } from '@mantine/core';
import { IconFileSpreadsheet, IconInfoCircle, IconUpload } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { HallData } from '../types/types.ts';
import { HallStore } from '../hooks/useHallStore.ts';
import { GROUP_COLORS, parseGuestImport } from '../utils/guests.ts';

interface ImportModalProps {
    opened: boolean;
    hall: HallData;
    store: HallStore;
    onClose: () => void;
    onImported: (count: number) => void;
}

/** Paste from Excel / Google Sheets or upload a CSV: name, group, meal, note. */
function ImportModal({ opened, hall, store, onClose, onImported }: ImportModalProps) {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const resetRef = useRef<() => void>(null);

    const rows = useMemo(() => parseGuestImport(text), [text]);
    const existingNames = useMemo(() => new Set(hall.guests.map(guest => guest.name.toLowerCase())), [hall.guests]);
    const toImport = skipDuplicates ? rows.filter(row => !existingNames.has(row.name.toLowerCase())) : rows;
    const duplicates = rows.length - rows.filter(row => !existingNames.has(row.name.toLowerCase())).length;
    const newGroups = [...new Set(toImport.map(row => row.group).filter((g): g is string => !!g))].filter(
        name => !hall.groups.some(group => group.name.toLowerCase() === name.toLowerCase()),
    );

    const readFile = async (file: File | null) => {
        if (!file) return;
        setText(await file.text());
        resetRef.current?.();
    };

    const submit = () => {
        // Create groups that don't exist yet, then map names → ids
        const groupIds = new Map(hall.groups.map(group => [group.name.toLowerCase(), group.id]));
        newGroups.forEach((name, i) => {
            const id = store.addGroup(name, GROUP_COLORS[(hall.groups.length + i) % GROUP_COLORS.length]);
            groupIds.set(name.toLowerCase(), id);
        });
        store.addGuests(
            toImport.map(row => ({
                name: row.name,
                ...(row.group ? { groupId: groupIds.get(row.group.toLowerCase()) } : {}),
                ...(row.meal && row.meal !== 'standard' ? { meal: row.meal } : {}),
                ...(row.note ? { note: row.note } : {}),
            })),
        );
        onImported(toImport.length);
        setText('');
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="lg"
            title={
                <Stack gap={2}>
                    <Text className="modal-title">{t('import_title')}</Text>
                    <Text size="xs" c="dimmed">{t('import_subtitle')}</Text>
                </Stack>
            }
        >
            <Stack gap="sm">
                <Alert variant="light" color="gold" icon={<IconInfoCircle size={16} />} p="xs">
                    <Text size="xs">{t('import_help')}</Text>
                </Alert>
                <Textarea
                    data-autofocus
                    autosize
                    minRows={6}
                    maxRows={12}
                    placeholder={t('import_placeholder')}
                    value={text}
                    onChange={e => setText(e.currentTarget.value)}
                    styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
                />
                <Group justify="space-between">
                    <FileButton resetRef={resetRef} onChange={readFile} accept=".csv,.txt,.tsv,text/csv,text/plain">
                        {props => (
                            <Button {...props} variant="light" color="gray" size="xs" leftSection={<IconUpload size={14} />}>
                                {t('import_file')}
                            </Button>
                        )}
                    </FileButton>
                    <Checkbox
                        size="xs"
                        checked={skipDuplicates}
                        onChange={e => setSkipDuplicates(e.currentTarget.checked)}
                        label={t('skip_duplicates', { count: duplicates })}
                    />
                </Group>

                {rows.length > 0 && (
                    <ScrollArea.Autosize mah={220} type="auto">
                        <Table striped withTableBorder fz="xs" verticalSpacing={4}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>#</Table.Th>
                                    <Table.Th>{t('guest_name_label')}</Table.Th>
                                    <Table.Th>{t('group')}</Table.Th>
                                    <Table.Th>{t('meal')}</Table.Th>
                                    <Table.Th>{t('note')}</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {rows.slice(0, 200).map((row, i) => (
                                    <Table.Tr key={i} style={{ opacity: skipDuplicates && existingNames.has(row.name.toLowerCase()) ? 0.4 : 1 }}>
                                        <Table.Td>{i + 1}</Table.Td>
                                        <Table.Td>{row.name}</Table.Td>
                                        <Table.Td>{row.group}</Table.Td>
                                        <Table.Td>{row.meal ? t(`meal_${row.meal}`) : ''}</Table.Td>
                                        <Table.Td>{row.note}</Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea.Autosize>
                )}

                <Group justify="space-between">
                    <Group gap={6}>
                        <Badge color="gold" variant="light" leftSection={<IconFileSpreadsheet size={12} />}>
                            {t('import_count', { count: toImport.length })}
                        </Badge>
                        {newGroups.length > 0 && (
                            <Badge color="blush" variant="light">{t('import_new_groups', { count: newGroups.length })}</Badge>
                        )}
                    </Group>
                    <Group gap="xs">
                        <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                        <Button onClick={submit} disabled={!toImport.length}>{t('btn_import_n', { count: toImport.length })}</Button>
                    </Group>
                </Group>
            </Stack>
        </Modal>
    );
}

export default ImportModal;
