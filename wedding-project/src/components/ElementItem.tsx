import { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { ActionIcon, Menu, Tooltip } from '@mantine/core';
import {
    IconArrowsMaximize,
    IconArrowsMinimize,
    IconCheck,
    IconPencil,
    IconRotateClockwise2,
    IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ELEMENT_SHAPES, ElementShape, HallElement } from '../types/types.ts';
import { elementLabelKey, elementShape, PARALLELOGRAM_SKEW } from '../utils/elements.ts';
import { ElementIcon } from './ElementIcon';

interface ElementItemProps {
    element: HallElement;
    zoom: number;
    readOnly: boolean;
    onMove: (id: number, x: number, y: number) => void;
    onResize: (id: number, factor: number) => void;
    onSetSize: (id: number, w: number, h: number) => void;
    onSetShape: (id: number, shape: ElementShape) => void;
    onRotate: (id: number) => void;
    onRename: (id: number, currentLabel: string) => void;
    onDelete: (id: number) => void;
}

type Handle = 'e' | 's' | 'se';

/** Tiny outline of each shape for the shape menu. */
export function ShapeGlyph({ shape, size = 16 }: { shape: ElementShape; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
            {shape === 'rect' && <rect x={1.5} y={4} width={13} height={8} rx={1.5} />}
            {shape === 'round' && <ellipse cx={8} cy={8} rx={6.5} ry={5} />}
            {shape === 'parallelogram' && <path d="M4.5 4 H14.5 L11.5 12 H1.5 Z" strokeLinejoin="round" />}
        </svg>
    );
}

/** Stage, dance floor, DJ, entranceâ€¦ â€” draggable decor that gives the plan its real shape. */
function ElementItem({ element, zoom, readOnly, onMove, onResize, onSetSize, onSetShape, onRotate, onRename, onDelete }: ElementItemProps) {
    const { t } = useTranslation();
    const nodeRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [resizing, setResizing] = useState<{ handle: Handle; x: number; y: number; w: number; h: number } | null>(null);
    const label = element.label || t(elementLabelKey(element.kind));
    const shape = elementShape(element);
    const vertical = element.rotation % 180 !== 0;
    const minSide = Math.min(element.w, element.h);
    const skew = shape === 'parallelogram';

    // Resize handles: the mouse movement is turned into the element's own (rotated) axes
    useEffect(() => {
        if (!resizing) return;
        const angle = (-element.rotation * Math.PI) / 180;
        const move = (e: PointerEvent) => {
            const dx = (e.clientX - resizing.x) / zoom;
            const dy = (e.clientY - resizing.y) / zoom;
            const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
            const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
            const w = resizing.handle === 's' ? resizing.w : resizing.w + localX;
            const h = resizing.handle === 'e' ? resizing.h : resizing.h + localY;
            onSetSize(element.id, w, h);
        };
        const stop = () => setResizing(null);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
    }, [resizing, element.id, element.rotation, zoom, onSetSize]);

    const startResize = (handle: Handle) => (e: React.PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setResizing({ handle, x: e.clientX, y: e.clientY, w: element.w, h: element.h });
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            bounds="parent"
            position={{ x: element.x, y: element.y }}
            scale={zoom}
            disabled={readOnly || !!resizing}
            cancel=".table-action, .resize-handle"
            onStart={() => setIsDragging(true)}
            onStop={(_e, data) => {
                setIsDragging(false);
                onMove(element.id, data.x, data.y);
            }}
        >
            <div
                ref={nodeRef}
                className={`hall-element-wrapper ${isDragging ? 'dragging' : ''} ${resizing ? 'resizing' : ''} ${readOnly ? 'read-only' : ''}`}
                style={{ width: element.w, height: element.h }}
            >
                <div
                    className={`hall-element kind-${element.kind} shape-${shape}`}
                    style={{ transform: `rotate(${element.rotation}deg)${skew ? ` skewX(${-PARALLELOGRAM_SKEW}deg)` : ''}` }}
                    onDoubleClick={() => !readOnly && onRename(element.id, label)}
                >
                    {element.kind !== 'column' && (
                        <div
                            className="hall-element-content"
                            style={{ transform: `${skew ? `skewX(${PARALLELOGRAM_SKEW}deg) ` : ''}${vertical ? `rotate(${-element.rotation}deg)` : ''}` || undefined }}
                        >
                            {minSide >= 60 && <ElementIcon kind={element.kind} size={Math.min(30, minSide / 3)} />}
                            <span style={{ fontSize: Math.max(10, Math.min(18, minSide / 4)) }}>{label}</span>
                        </div>
                    )}

                    {!readOnly && (
                        <>
                            <span className="resize-handle handle-e" onPointerDown={startResize('e')} />
                            <span className="resize-handle handle-s" onPointerDown={startResize('s')} />
                            <span className="resize-handle handle-se" onPointerDown={startResize('se')} />
                        </>
                    )}
                </div>

                {!readOnly && (
                    <div className="action-bar element-bar">
                        <Menu position="bottom" withinPortal shadow="md">
                            <Menu.Target>
                                <ActionIcon
                                    className="table-action"
                                    variant="subtle"
                                    color="wine"
                                    size="md"
                                    radius="xl"
                                    aria-label={t('element_shape')}
                                    title={t('element_shape')}
                                >
                                    <ShapeGlyph shape={shape} />
                                </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                {ELEMENT_SHAPES.map(option => (
                                    <Menu.Item
                                        key={option}
                                        leftSection={<ShapeGlyph shape={option} />}
                                        rightSection={option === shape ? <IconCheck size={14} /> : undefined}
                                        onClick={() => onSetShape(element.id, option)}
                                    >
                                        {t(`el_shape_${option}`)}
                                    </Menu.Item>
                                ))}
                            </Menu.Dropdown>
                        </Menu>
                        <Tooltip label={t('tooltip_bigger')}>
                            <ActionIcon className="table-action" variant="subtle" color="sage" size="md" radius="xl" onClick={() => onResize(element.id, 1.15)}>
                                <IconArrowsMaximize size={15} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('tooltip_smaller')}>
                            <ActionIcon className="table-action" variant="subtle" color="sage" size="md" radius="xl" onClick={() => onResize(element.id, 1 / 1.15)}>
                                <IconArrowsMinimize size={15} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('tooltip_rotate_90')}>
                            <ActionIcon className="table-action" variant="subtle" color="blush" size="md" radius="xl" onClick={() => onRotate(element.id)}>
                                <IconRotateClockwise2 size={16} />
                            </ActionIcon>
                        </Tooltip>
                        {element.kind !== 'column' && (
                            <Tooltip label={t('tooltip_rename')}>
                                <ActionIcon className="table-action" variant="subtle" color="gold" size="md" radius="xl" onClick={() => onRename(element.id, label)}>
                                    <IconPencil size={15} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        <span className="action-sep" />
                        <Tooltip label={t('tooltip_delete_element')}>
                            <ActionIcon className="table-action" variant="subtle" color="red" size="md" radius="xl" onClick={() => onDelete(element.id)}>
                                <IconTrash size={16} />
                            </ActionIcon>
                        </Tooltip>
                    </div>
                )}
            </div>
        </Draggable>
    );
}

export default ElementItem;
