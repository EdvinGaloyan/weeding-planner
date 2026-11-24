import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconCalendarEvent, IconHeart, IconTemplate } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Template } from '../types/types.ts';
import { Flourish } from './Illustrations';

export interface EventFormValues {
    title: string;
    date: string;
    templateId: string | null;
}

interface EventFormModalProps {
    opened: boolean;
    onClose: () => void;
    /** Present when editing an existing event. */
    initial?: { title: string; date: string };
    templates?: Template[];
    onSubmit: (values: EventFormValues) => Promise<void>;
}

function EventFormModal({ opened, onClose, initial, templates = [], onSubmit }: EventFormModalProps) {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!opened) return;
        setTitle(initial?.title || '');
        setDate(initial?.date || '');
        setTemplateId(templates[0]?.id ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);
        try {
            await onSubmit({ title: title.trim(), date, templateId });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="md"
            title={<Text className="modal-title">{t(initial ? 'edit_event' : 'new_event')}</Text>}
        >
            <form onSubmit={submit}>
                <Stack gap="sm">
                    <Flourish width={140} className="modal-flourish" />
                    <TextInput
                        data-autofocus
                        required
                        label={t('event_title')}
                        placeholder={t('event_title_placeholder')}
                        leftSection={<IconHeart size={16} />}
                        value={title}
                        onChange={e => setTitle(e.currentTarget.value)}
                        maxLength={120}
                    />
                    <TextInput
                        type="date"
                        label={t('event_date')}
                        leftSection={<IconCalendarEvent size={16} />}
                        value={date}
                        onChange={e => setDate(e.currentTarget.value)}
                    />
                    {!initial && (
                        <Select
                            label={t('start_from')}
                            leftSection={<IconTemplate size={16} />}
                            description={templates.length ? t('start_from_hint') : t('no_templates_hint')}
                            data={[
                                { value: '', label: t('empty_hall') },
                                ...templates.map(template => ({ value: template.id, label: template.name })),
                            ]}
                            value={templateId ?? ''}
                            onChange={value => setTemplateId(value || null)}
                            allowDeselect={false}
                        />
                    )}
                    <Group justify="flex-end" mt="xs">
                        <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                        <Button type="submit" loading={loading} disabled={!title.trim()}>
                            {t(initial ? 'btn_save' : 'btn_create')}
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}

export default EventFormModal;
