import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Flourish } from './Illustrations';

interface NameModalProps {
    opened: boolean;
    title: string;
    subtitle?: string;
    label: string;
    placeholder?: string;
    initialValue: string;
    onClose: () => void;
    onSave: (value: string) => void;
    /** When provided, shows a secondary action that clears the value. */
    clearLabel?: string;
}

function NameModal({ opened, title, subtitle, label, placeholder, initialValue, onClose, onSave, clearLabel }: NameModalProps) {
    const { t } = useTranslation();
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (opened) setValue(initialValue);
    }, [opened, initialValue]);

    const submit = (e?: React.FormEvent) => {
        e?.preventDefault();
        onSave(value.trim());
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="sm"
            title={
                <Stack gap={2}>
                    <Text className="modal-title">{title}</Text>
                    {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
                </Stack>
            }
        >
            <form onSubmit={submit}>
                <Stack gap="md">
                    <Flourish width={140} className="modal-flourish" />
                    <TextInput
                        data-autofocus
                        label={label}
                        placeholder={placeholder}
                        value={value}
                        onChange={e => setValue(e.currentTarget.value)}
                    />
                    <Group justify="space-between">
                        {clearLabel && initialValue ? (
                            <Button
                                variant="subtle"
                                color="red"
                                onClick={() => {
                                    onSave('');
                                    onClose();
                                }}
                            >
                                {clearLabel}
                            </Button>
                        ) : <span />}
                        <Group gap="xs">
                            <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                            <Button type="submit">{t('btn_save')}</Button>
                        </Group>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}

export default NameModal;
