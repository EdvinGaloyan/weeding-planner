import { useEffect, useState } from 'react';
import { Button, ColorInput, FileButton, Group, Image, Modal, Paper, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPhotoUp, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Venue } from '../types/types.ts';
import { updateVenue } from '../api/endpoints.ts';
import { Flourish, RingsWreath } from './Illustrations';

interface VenueSettingsModalProps {
    opened: boolean;
    onClose: () => void;
    venue: Venue;
    onSaved: (venue: Venue) => void;
}

const LOGO_MAX = 360;

/** Shrinks an uploaded logo so it stays small enough to store and print sharply. */
function resizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
            const scale = Math.min(1, LOGO_MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('invalid image'));
        };
        img.src = url;
    });
}

function VenueSettingsModal({ opened, onClose, venue, onSaved }: VenueSettingsModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState(venue.name);
    const [logo, setLogo] = useState(venue.logo || '');
    const [brandColor, setBrandColor] = useState(venue.brandColor || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!opened) return;
        setName(venue.name);
        setLogo(venue.logo || '');
        setBrandColor(venue.brandColor || '');
    }, [opened, venue]);

    const save = async () => {
        setLoading(true);
        try {
            const saved = await updateVenue({ name: name.trim(), logo, brandColor });
            onSaved(saved);
            notifications.show({ color: 'sage', message: t('saved_ok') });
            onClose();
        } catch {
            notifications.show({ color: 'red', message: t('save_failed') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="md"
            title={
                <Stack gap={2}>
                    <Text className="modal-title">{t('venue_settings')}</Text>
                    <Text size="xs" c="dimmed">{t('venue_settings_hint')}</Text>
                </Stack>
            }
        >
            <Stack gap="sm">
                <Flourish width={140} className="modal-flourish" />
                <TextInput label={t('venue_name')} value={name} onChange={e => setName(e.currentTarget.value)} maxLength={120} />

                <Paper withBorder radius="md" p="sm">
                    <Group wrap="nowrap" align="center">
                        <div className="logo-preview">
                            {logo ? <Image src={logo} alt="" fit="contain" h={72} w={72} /> : <RingsWreath size={64} />}
                        </div>
                        <Stack gap={6} flex={1}>
                            <Text size="sm" fw={600}>{t('venue_logo')}</Text>
                            <Text size="xs" c="dimmed">{t('venue_logo_hint')}</Text>
                            <Group gap={6}>
                                <FileButton
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={async file => {
                                        if (!file) return;
                                        try {
                                            setLogo(await resizeImage(file));
                                        } catch {
                                            notifications.show({ color: 'red', message: t('invalid_image') });
                                        }
                                    }}
                                >
                                    {props => (
                                        <Button {...props} size="xs" variant="light" leftSection={<IconPhotoUp size={14} />}>
                                            {t('upload')}
                                        </Button>
                                    )}
                                </FileButton>
                                {logo && (
                                    <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => setLogo('')}>
                                        {t('btn_delete')}
                                    </Button>
                                )}
                            </Group>
                        </Stack>
                    </Group>
                </Paper>

                <ColorInput
                    label={t('brand_color')}
                    description={t('brand_color_hint')}
                    placeholder="#4a1f2b"
                    value={brandColor}
                    onChange={setBrandColor}
                    format="hex"
                    swatches={['#4a1f2b', '#b24f66', '#9c6f2a', '#2f5d50', '#1f3a5f', '#3f3230', '#6b4c9a']}
                />

                <Group justify="flex-end" mt="xs">
                    <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                    <Button onClick={save} loading={loading} disabled={!name.trim()}>{t('btn_save')}</Button>
                </Group>
            </Stack>
        </Modal>
    );
}

export default VenueSettingsModal;
