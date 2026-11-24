import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { ActionIcon, Tooltip } from '@mantine/core';
import {
    IconArrowsMaximize,
    IconArrowsMinimize,
    IconCrown,
    IconRotateClockwise2,
    IconTrash,
    IconUserMinus,
    IconUserPlus,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import Chair from './Chair';
import { Guest, TableData } from '../types/types.ts';
import { acceptsGuest, readDraggedGuest } from '../utils/dnd.ts';
import { tableDimensions } from '../utils/seating.ts';
import { chairLayout, isCoupleSeat } from '../utils/chairs.ts';

interface TableItemProps {
    table: TableData;
    index: number;
    updateTableCapacity: (id: number, newCapacity: number) => void;
    updateTablePosition: (id: number, x: number, y: number) => void;
    deleteTable: (id: number) => void;
    rotateTable: (id: number, angle: number) => void;
    updateTableSize: (id: number, delta: number) => void;
    onEditTableName: (tableId: number, currentLabel: string) => void;
    onEditGuest: (tableId: number, chairIndex: number, tableLabel: string) => void;
    onOpenDetails: (tableId: number) => void;
    onDropGuest: (tableId: number, seat: number | null, guestId: string) => void;
    /** Guest on each chair (index = chair). */
    seats: (Guest | undefined)[];
    groupColors: Map<string, string>;
    matchIds: Set<string>;
    zoom: number;
    /** Couple mode: tables can't be moved or changed. */
    readOnly: boolean;
}

const CHAIR_OFFSET = 18;
const CHAIR_HALF = 9;

/**
 * Largest font size (≤ base) at which the label fits `maxWidth`:
 * on one line if possible, otherwise on two lines without breaking words.
 * Uses an average glyph width of ~0.62em (Armenian serif glyphs are fairly wide).
 */
function fitFontSize(label: string, maxWidth: number, base: number, min: number) {
    const glyph = 0.62;
    const longestWord = Math.max(1, ...label.split(/\s+/).map(word => word.length));
    const oneLine = maxWidth / (Math.max(1, label.length) * glyph);
    const twoLines = Math.min(maxWidth / (longestWord * glyph), (maxWidth * 2) / (label.length * glyph));
    return Math.round(Math.max(min, Math.min(base, Math.max(oneLine, twoLines))));
}

function TableItem({
    table,
    index,
    updateTableCapacity,
    updateTablePosition,
    deleteTable,
    rotateTable,
    updateTableSize,
    onEditTableName,
    onEditGuest,
    onOpenDetails,
    onDropGuest,
    seats,
    groupColors,
    matchIds,
    zoom,
    readOnly,
}: TableItemProps) {
    const { t } = useTranslation();
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const startTimeRef = useRef<number>(0);
    const startCoordsRef = useRef<{ x: number; y: number } | null>(null);
    const hasMovedRef = useRef<boolean>(false);

    const rotation = table.rotation || 0;
    const { size, height } = tableDimensions(table);

    // Text orientation:
    //  - round tables: always upright on screen
    //  - rectangular tables: text runs along the table's long side (like printed
    //    seating charts) and is flipped 180° when it would otherwise be upside down.
    //    This keeps the font size identical at every rotation angle.
    const normalized = ((rotation % 360) + 360) % 360;
    const textRotation = table.shape === 'round' ? -rotation : normalized > 90 && normalized <= 270 ? 180 : 0;
    const textMaxWidth = (table.shape === 'round' ? size * 0.75 : size * 0.9) - (table.isHeadTable ? 28 : 0);

    const label = table.tableName || (table.isHeadTable ? t('head_table_default') : `${t('table')} ${index + 1}`);

    // Font size scales with the table and shrinks so long names still fit
    const baseTitle = Math.min(size * 0.11, height * 0.24, 30);
    const titleFontSize = fitFontSize(label, textMaxWidth, baseTitle, 11);
    const subtitleFontSize = Math.max(9, Math.round(Math.min(titleFontSize * 0.55, 14)));
    const guestCount = seats.filter(Boolean).length;
    const [isDropOver, setIsDropOver] = useState(false);

    const stop = (fn: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        fn();
    };

    const startRotation = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        startTimeRef.current = Date.now();
        startCoordsRef.current = { x: e.clientX, y: e.clientY };
        hasMovedRef.current = false;
        setIsRotating(true);
    };

    useEffect(() => {
        if (!isRotating || table.shape !== 'rect') return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!nodeRef.current) return;

            if (startCoordsRef.current) {
                const dx = e.clientX - startCoordsRef.current.x;
                const dy = e.clientY - startCoordsRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 8) hasMovedRef.current = true;
            }

            if (hasMovedRef.current) {
                const rect = nodeRef.current.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                let degrees = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                if (degrees < 0) degrees += 360;
                rotateTable(table.id, Math.round(degrees));
            }
        };

        const handleMouseUp = () => {
            const clickDuration = Date.now() - startTimeRef.current;
            if (clickDuration < 250 && !hasMovedRef.current) {
                // Quick click: snap to the next quarter turn
                rotateTable(table.id, (Math.floor(rotation / 90) * 90 + 90) % 360);
            }
            setIsRotating(false);
            startCoordsRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isRotating, table.id, table.shape, rotation, rotateTable]);

    const chairs = chairLayout(table, size, height, CHAIR_OFFSET);
    const shapeClass = table.isHeadTable ? 'head' : table.shape;

    // A single click on the name renames the table; a double click anywhere opens the
    // enlarged view. Delay the rename slightly so a double click doesn't trigger both.
    const nameClickTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(nameClickTimer.current), []);

    const handleNameClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.detail > 1) return;
        window.clearTimeout(nameClickTimer.current);
        nameClickTimer.current = window.setTimeout(() => onEditTableName(table.id, label), 260);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.clearTimeout(nameClickTimer.current);
        onOpenDetails(table.id);
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            bounds="parent"
            position={{ x: table.x, y: table.y }}
            scale={zoom}
            disabled={isRotating || readOnly}
            cancel=".table-action, .table-name, .chair"
            onStart={() => setIsDragging(true)}
            onStop={(_e, data) => {
                updateTablePosition(table.id, data.x, data.y);
                setIsDragging(false);
            }}
        >
            <div
                ref={nodeRef}
                className={`table-wrapper ${table.isHeadTable ? 'head-table-wrapper' : ''} ${isDragging ? 'dragging' : ''} ${readOnly ? 'read-only' : ''}`}
                style={{ width: `${size}px`, height: `${height}px` }}
            >
                <div className="rotatable-container" style={{ transform: `rotate(${rotation}deg)` }}>
                    <div
                        className={`table-item ${shapeClass} table-animation ${isDropOver ? 'drop-over' : ''}`}
                        onDoubleClick={handleDoubleClick}
                        onDragOver={e => {
                            if (!acceptsGuest(e)) return;
                            e.preventDefault();
                            if (!isDropOver) setIsDropOver(true);
                        }}
                        onDragLeave={() => setIsDropOver(false)}
                        onDrop={e => {
                            e.preventDefault();
                            setIsDropOver(false);
                            const guestId = readDraggedGuest(e);
                            if (guestId) onDropGuest(table.id, null, guestId);
                        }}
                    >
                        <div
                            className="table-content"
                            style={{
                                transform: `rotate(${textRotation}deg)`,
                                maxWidth: `${table.shape === 'round' ? size * 0.75 : size * 0.9}px`,
                            }}
                        >
                            <div className="table-title-row">
                                {table.isHeadTable && <IconCrown size={Math.round(titleFontSize * 0.85)} className="head-crown" />}
                                <Tooltip label={t('table_name_hint')} multiline maw={220} ta="center" disabled={table.isHeadTable || readOnly}>
                                    <span
                                        className="table-name"
                                        style={{ fontSize: `${titleFontSize}px` }}
                                        onClick={handleNameClick}
                                        onDoubleClick={handleDoubleClick}
                                    >
                                        {label}
                                    </span>
                                </Tooltip>
                            </div>
                            <span className="table-meta" style={{ fontSize: `${subtitleFontSize}px` }}>
                                {guestCount}/{table.capacity} {t('person')}
                            </span>
                        </div>
                    </div>

                    {chairs.map(({ x, y }, i) => (
                        <Chair
                            key={i}
                            index={i}
                            x={x - CHAIR_HALF}
                            y={y - CHAIR_HALF}
                            guest={seats[i]}
                            groupColor={seats[i]?.groupId ? groupColors.get(seats[i]!.groupId!) : undefined}
                            isCouple={table.isHeadTable && isCoupleSeat(i)}
                            showTooltip={!table.isHeadTable}
                            isMatch={!!seats[i] && matchIds.has(seats[i]!.id)}
                            counterRotation={rotation}
                            onEdit={chairIndex => onEditGuest(table.id, chairIndex, label)}
                            onDropGuest={(chairIndex, guestId) => onDropGuest(table.id, chairIndex, guestId)}
                        />
                    ))}
                </div>

                {/* Kept outside the rotated container so the toolbar always stays upright */}
                {!readOnly && (
                <div className="action-bar">
                    {!table.isHeadTable && (
                        <>
                            <Tooltip label={t('tooltip_add_seat')}>
                                <ActionIcon className="table-action" variant="subtle" color="gold" size="md" radius="xl"
                                            onClick={stop(() => updateTableCapacity(table.id, table.capacity + 1))}>
                                    <IconUserPlus size={16} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label={t('tooltip_remove_seat')}>
                                <ActionIcon className="table-action" variant="subtle" color="gold" size="md" radius="xl"
                                            disabled={table.capacity <= 1}
                                            onClick={stop(() => updateTableCapacity(table.id, table.capacity - 1))}>
                                    <IconUserMinus size={16} />
                                </ActionIcon>
                            </Tooltip>
                            <span className="action-sep" />
                        </>
                    )}
                    <Tooltip label={t('tooltip_bigger')}>
                        <ActionIcon className="table-action" variant="subtle" color="sage" size="md" radius="xl"
                                    onClick={stop(() => updateTableSize(table.id, 20))}>
                            <IconArrowsMaximize size={15} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('tooltip_smaller')}>
                        <ActionIcon className="table-action" variant="subtle" color="sage" size="md" radius="xl"
                                    onClick={stop(() => updateTableSize(table.id, -20))}>
                            <IconArrowsMinimize size={15} />
                        </ActionIcon>
                    </Tooltip>
                    {table.shape === 'rect' && (
                        <Tooltip label={t('tooltip_rotate')}>
                            <ActionIcon className="table-action" variant="subtle" color="blush" size="md" radius="xl"
                                        onMouseDown={startRotation}>
                                <IconRotateClockwise2 size={16} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                    <span className="action-sep" />
                    <Tooltip label={t('tooltip_delete')}>
                        <ActionIcon className="table-action" variant="subtle" color="red" size="md" radius="xl"
                                    onClick={stop(() => deleteTable(table.id))}>
                            <IconTrash size={16} />
                        </ActionIcon>
                    </Tooltip>
                </div>
                )}
            </div>
        </Draggable>
    );
}

export default TableItem;
