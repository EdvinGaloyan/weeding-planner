import { useEffect, useState } from 'react';
import { Alert, Button, CopyButton, Group, Image, Modal, Paper, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy, IconDownload, IconHeartHandshake, IconQrcode, IconRefresh } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { modals } from '@mantine/modals';
import { makeQr } from './PrintModal';

interface ShareModalProps {
    opened: boolean;
    onClose: () => void;
    coupleUrl: string;
    lookupUrl: string;
    eventTitle: string;
    onRotate: () => Promise<void>;
}

function LinkField({ value }: { value: string }) {
    const { t } = useTranslation();
    return (
        <Group gap={6} wrap="nowrap">
            <TextInput flex={1} value={value} readOnly onFocus={e => e.currentTarget.select()} size="sm" />
            <CopyButton value={value} timeout={2000}>
                {({ copied, copy }) => (
                    <Tooltip label={copied ? t('copied') : t('copy')}>
                        <Button size="sm" variant={copied ? 'filled' : 'light'} color={copied ? 'sage' : 'gold'} onClick={copy} px="sm">
                            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                        </Button>
                    </Tooltip>
                )}
            </CopyButton>
        </Group>
    );
}

/** The couple's private editing link and the public QR "find your table" page. */
function ShareModal({ opened, onClose, coupleUrl, lookupUrl, eventTitle, onRotate }: ShareModalProps) {
    const { t } = useTranslation();
    const [qr, setQr] = useState<string>();
    const [rotating, setRotating] = useState(false);

    useEffect(() => {
        if (opened) makeQr(lookupUrl, 900).then(setQr).catch(() => setQr(undefined));
    }, [opened, lookupUrl]);

    const rotate = () =>
        modals.openConfirmModal({
            title: <Text className="modal-title">{t('rotate_link_title')}</Text>,
            children: <Text size="sm" c="dimmed">{t('rotate_link_text')}</Text>,
            labels: { confirm: t('btn_confirm'), cancel: t('btn_cancel') },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                setRotating(true);
                await onRotate().finally(() => setRotating(false));
            },
        });

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="lg"
            title={
                <Stack gap={2}>
                    <Text className="modal-title">{t('share_title')}</Text>
                    <Text size="xs" c="dimmed">{eventTitle}</Text>
                </Stack>
            }
        >
            <Stack gap="md">
                <Paper className="share-card" radius="md" p="md">
                    <Stack gap="xs">
                        <Group gap={8}>
                            <IconHeartHandshake size={20} color="var(--rose)" />
                            <Text fw={700}>{t('share_couple')}</Text>
                        </Group>
                        <Text size="sm" c="dimmed">{t('share_couple_hint')}</Text>
                        <LinkField value={coupleUrl} />
                        <Group justify="flex-end">
                            <Button size="xs" variant="subtle" color="red" leftSection={<IconRefresh size={14} />} loading={rotating} onClick={rotate}>
                                {t('rotate_link')}
                            </Button>
                        </Group>
                    </Stack>
                </Paper>

                <Paper className="share-card" radius="md" p="md">
                    <Group align="flex-start" wrap="nowrap" gap="md">
                        <Stack gap="xs" flex={1}>
                            <Group gap={8}>
                                <IconQrcode size={20} color="var(--gold)" />
                                <Text fw={700}>{t('share_qr')}</Text>
                            </Group>
                            <Text size="sm" c="dimmed">{t('share_qr_hint')}</Text>
                            <LinkField value={lookupUrl} />
                            {qr && (
                                <Group gap="xs">
                                    <Button
                                        size="xs"
                                        variant="light"
                                        color="gold"
                                        leftSection={<IconDownload size={14} />}
                                        component="a"
                                        href={qr}
                                        download={`qr-${eventTitle.replace(/[^\p{L}\p{N}]+/gu, '-')}.png`}
                                    >
                                        {t('download_qr')}
                                    </Button>
                                    <Button size="xs" variant="subtle" color="gold" component="a" href={lookupUrl} target="_blank" rel="noreferrer">
                                        {t('open_page')}
                                    </Button>
                                </Group>
                            )}
                        </Stack>
                        {qr && <Image src={qr} w={150} h={150} radius="sm" alt="QR" className="share-qr" />}
                    </Group>
                </Paper>
                <Alert color="gray" variant="light" p="xs">
                    <Text size="xs">{t('share_privacy')}</Text>
                </Alert>
            </Stack>
        </Modal>
    );
}

export default ShareModal;
