import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { HallData, Venue } from '../types/types.ts';
import PrintDocument, { PRINT_SECTIONS, PrintSection } from './PrintDocument';

interface PrintModalProps {
    opened: boolean;
    onClose: () => void;
    hall: HallData;
    title: string;
    date: string;
    venue: Venue | null;
    /** Public "find your table" link; without it the QR poster is not offered. */
    lookupUrl?: string;
    tableLabelFor: (tableId: number) => string;
}

export async function makeQr(url: string, width = 640) {
    return QRCode.toDataURL(url, { margin: 1, width, errorCorrectionLevel: 'M', color: { dark: '#2b141b', light: '#ffffff' } });
}

/** Choose what to print; the browser's print dialog can also "Save as PDF". */
function PrintModal({ opened, onClose, hall, title, date, venue, lookupUrl, tableLabelFor }: PrintModalProps) {
    const { t } = useTranslation();
    const available = PRINT_SECTIONS.filter(section => section !== 'qr' || lookupUrl);
    const [selected, setSelected] = useState<PrintSection[]>(['plan', 'tables', 'alphabet']);
    const [printing, setPrinting] = useState<PrintSection[] | null>(null);
    const [qr, setQr] = useState<string>();

    useEffect(() => {
        if (lookupUrl) makeQr(lookupUrl).then(setQr).catch(() => setQr(undefined));
    }, [lookupUrl]);

    // Render the document, give images a moment to decode, then open the print dialog
    useEffect(() => {
        if (!printing) return;
        const done = () => setPrinting(null);
        window.addEventListener('afterprint', done, { once: true });
        const timer = window.setTimeout(() => window.print(), 350);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('afterprint', done);
        };
    }, [printing]);

    const toggle = (section: PrintSection, on: boolean) =>
        setSelected(current => (on ? PRINT_SECTIONS.filter(s => s === section || current.includes(s)) : current.filter(s => s !== section)));

    return (
        <>
            <Modal
                opened={opened}
                onClose={onClose}
                size="md"
                title={
                    <Stack gap={2}>
                        <Text className="modal-title">{t('print_title')}</Text>
                        <Text size="xs" c="dimmed">{t('print_subtitle')}</Text>
                    </Stack>
                }
            >
                <Stack gap="sm">
                    {available.map(section => (
                        <Checkbox
                            key={section}
                            checked={selected.includes(section)}
                            onChange={e => toggle(section, e.currentTarget.checked)}
                            label={<Text size="sm" fw={600}>{t(`print_${section}`)}</Text>}
                            description={t(`print_${section}_hint`)}
                        />
                    ))}
                    <Group justify="flex-end" mt="sm">
                        <Button variant="default" onClick={onClose}>{t('btn_cancel')}</Button>
                        <Button
                            leftSection={<IconPrinter size={16} />}
                            disabled={!selected.length}
                            onClick={() => {
                                setPrinting(selected.filter(section => available.includes(section)));
                                onClose();
                            }}
                        >
                            {t('btn_print')}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {printing &&
                createPortal(
                    <div className="print-root">
                        <PrintDocument
                            sections={printing}
                            hall={hall}
                            title={title}
                            date={date}
                            venue={venue}
                            qrDataUrl={qr}
                            tableLabelFor={tableLabelFor}
                        />
                    </div>,
                    document.body,
                )}
        </>
    );
}

export default PrintModal;
