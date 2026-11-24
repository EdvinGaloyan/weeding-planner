import { CSSProperties } from 'react';
import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconCrown, IconPencil, IconUsers } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Guest, TableData } from '../types/types.ts';
import { chairLayout, ChairPosition, headRoleKey, isCoupleSeat } from '../utils/chairs.ts';
import { Flourish } from './Illustrations';

interface TableDetailModalProps {
    table: TableData | undefined;
    label: string;
    seats: (Guest | undefined)[];
    groupColors: Map<string, string>;
    readOnlyName?: boolean;
    onClose: () => void;
    onEditGuest: (chairIndex: number) => void;
    onEditName: () => void;
}

const CHAIR_OFFSET = 34;
const LABEL_GAP = 24;
const LABEL_SPACE = 70; // vertical room reserved for labels above/below
const SIDE_LABEL_WIDTH = 160;

/** Size of the enlarged table, depending on its type. */
function detailSize(table: TableData) {
    if (table.isHeadTable) return { width: 600, height: 110 };
    if (table.shape === 'round') {
        const d = Math.max(240, Math.min(320, 200 + table.capacity * 8));
        return { width: d, height: d };
    }
    return { width: 440, height: 220 };
}

/** Places a name label outside the chair, aligned away from the table. */
function labelStyle({ x, y, nx, ny }: ChairPosition): CSSProperties {
    const left = x + nx * LABEL_GAP;
    const top = y + ny * LABEL_GAP;
    if (nx > 0.35) return { left, top, transform: 'translate(0, -50%)', textAlign: 'left', alignItems: 'flex-start' };
    if (nx < -0.35) return { left, top, transform: 'translate(-100%, -50%)', textAlign: 'right', alignItems: 'flex-end' };
    if (ny < 0) return { left, top, transform: 'translate(-50%, -100%)', textAlign: 'center', alignItems: 'center' };
    return { left, top, transform: 'translate(-50%, 0)', textAlign: 'center', alignItems: 'center' };
}

function TableDetailModal({ table, label, seats, groupColors, onClose, onEditGuest, onEditName }: TableDetailModalProps) {
    const { t } = useTranslation();

    const content = (() => {
        if (!table) return null;

        const { width, height } = detailSize(table);
        const chairs = chairLayout(table, width, height, CHAIR_OFFSET);
        const hasSideLabels = chairs.some(c => Math.abs(c.nx) > 0.35);

        // Canvas big enough for the table, chairs and labels on every side
        const padX = hasSideLabels ? CHAIR_OFFSET + LABEL_GAP + SIDE_LABEL_WIDTH : CHAIR_OFFSET + 40;
        const padTop = CHAIR_OFFSET + LABEL_GAP + LABEL_SPACE;
        const padBottom = table.isHeadTable ? 30 : padTop;
        const canvasWidth = width + padX * 2;
        const canvasHeight = height + padTop + padBottom;

        const guestCount = seats.filter(Boolean).length;
        const shapeClass = table.isHeadTable ? 'head' : table.shape;

        return (
            <Stack gap="md" align="center">
                <Group gap="xs">
                    <Badge
                        size="lg"
                        variant="light"
                        color={guestCount === table.capacity ? 'sage' : 'gold'}
                        leftSection={<IconUsers size={14} />}
                    >
                        {guestCount}/{table.capacity} {t('person')}
                    </Badge>
                </Group>

                <div className="detail-scroll">
                    <div className="detail-canvas" style={{ width: canvasWidth, height: canvasHeight }}>
                        <div
                            className="detail-origin"
                            style={{ left: padX, top: padTop, width, height }}
                        >
                            <div className={`detail-table ${shapeClass}`}>
                                <div className="detail-table-label">
                                    {table.isHeadTable && <IconCrown size={22} />}
                                    <span>{label}</span>
                                </div>
                            </div>

                            {chairs.map((position, i) => {
                                const guest = seats[i];
                                const name = guest?.name;
                                const color = guest?.groupId ? groupColors.get(guest.groupId) : undefined;
                                const role = headRoleKey(table, i);
                                const couple = table.isHeadTable && isCoupleSeat(i);
                                return (
                                    <div key={i}>
                                        <button
                                            type="button"
                                            className={`detail-chair ${name ? 'has-guest' : ''} ${couple ? 'couple' : ''}`}
                                            style={{ left: position.x, top: position.y, ...(color ? { background: color } : {}) }}
                                            onClick={() => onEditGuest(i)}
                                            aria-label={`${role ? t(role) : t('seat')} ${i + 1}`}
                                        >
                                            {i + 1}
                                        </button>
                                        <button
                                            type="button"
                                            className={`detail-label ${name ? '' : 'empty'}`}
                                            style={{ ...labelStyle(position), maxWidth: hasSideLabels && Math.abs(position.nx) > 0.35 ? SIDE_LABEL_WIDTH : 130 }}
                                            onClick={() => onEditGuest(i)}
                                        >
                                            {role && <span className={`detail-role ${couple ? 'couple' : ''}`}>{t(role)}</span>}
                                            <span className="detail-name">{name || t('seat_free')}</span>
                                            {guest?.note && <span className="detail-note">{guest.note}</span>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <Text size="xs" c="dimmed">{t('detail_hint')}</Text>
            </Stack>
        );
    })();

    return (
        <Modal
            opened={!!table}
            onClose={onClose}
            size={920}
            title={
                <Stack gap={2}>
                    <Group gap={8}>
                        <Text className="modal-title">{label}</Text>
                        <Button size="compact-xs" variant="subtle" leftSection={<IconPencil size={12} />} onClick={onEditName}>
                            {t('edit_table_name')}
                        </Button>
                    </Group>
                    <Flourish width={140} />
                </Stack>
            }
        >
            {content}
        </Modal>
    );
}

export default TableDetailModal;
