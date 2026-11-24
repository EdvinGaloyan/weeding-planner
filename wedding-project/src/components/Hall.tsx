import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import TableItem from './TableItem';
import ElementItem from './ElementItem';
import { Guest, HallData } from '../types/types.ts';
import { Flourish, RingsWreath } from './Illustrations';
import { tableDimensions, tableNumber } from '../utils/seating.ts';
import { seatIndex, seatKey } from '../utils/guests.ts';
import { HallStore } from '../hooks/useHallStore.ts';

interface HallProps {
    hall: HallData;
    store: HallStore;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    zoom: number;
    readOnly: boolean;
    isArranging: boolean;
    isLoading: boolean;
    matchIds: Set<string>;
    onEditTableName: (tableId: number, currentLabel: string) => void;
    onEditGuest: (tableId: number, chairIndex: number, tableLabel: string) => void;
    onOpenDetails: (tableId: number) => void;
    onDropGuest: (tableId: number, seat: number | null, guestId: string) => void;
    onRenameElement: (id: number, label: string) => void;
}

const EDGE = 60;

/** Keeps track of the viewport size so the canvas always fills it at any zoom. */
function useElementSize(ref: React.RefObject<HTMLElement | null>) {
    const [size, setSize] = useState({ width: 0, height: 0 });
    const hasMeasured = useRef(false); // first measurement is applied immediately
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        // Debounced: while a side panel slides, the viewport changes every frame and
        // re-rendering every table each frame makes the animation stutter.
        let timer: number | undefined;
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            window.clearTimeout(timer);
            timer = window.setTimeout(
                () => setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height })),
                hasMeasured.current ? 120 : 0,
            );
            hasMeasured.current = true;
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
            window.clearTimeout(timer);
        };
    }, [ref]);
    return size;
}

function Hall({
    hall,
    store,
    viewportRef,
    zoom,
    readOnly,
    isArranging,
    isLoading,
    matchIds,
    onEditTableName,
    onEditGuest,
    onOpenDetails,
    onDropGuest,
    onRenameElement,
}: HallProps) {
    const { t } = useTranslation();
    const { tables, elements, bgGradients } = hall;
    const hasCustomBg = bgGradients.color1 && bgGradients.color2;
    const viewport = useElementSize(viewportRef);

    const seats = useMemo(() => seatIndex(hall.guests), [hall.guests]);
    const groupColors = useMemo(() => new Map(hall.groups.map(group => [group.id, group.color])), [hall.groups]);

    // The canvas is at least as big as the screen, and grows when tables are placed further out
    const content = useMemo(() => {
        let right = 0;
        let bottom = 0;
        tables.forEach(table => {
            const { size, height } = tableDimensions(table);
            const reach = Math.hypot(size, height) / 2 + 40;
            right = Math.max(right, table.x + size / 2 + reach);
            bottom = Math.max(bottom, table.y + height / 2 + reach);
        });
        elements.forEach(e => {
            right = Math.max(right, e.x + e.w);
            bottom = Math.max(bottom, e.y + e.h);
        });
        return { right: right + EDGE, bottom: bottom + EDGE };
    }, [tables, elements]);

    const canvasWidth = Math.max(viewport.width / zoom, content.right);
    const canvasHeight = Math.max(viewport.height / zoom, content.bottom);
    const isEmpty = tables.length === 0 && elements.length === 0;

    return (
        <div
            ref={viewportRef}
            className={`hall-viewport ${hasCustomBg ? 'custom-bg' : ''}`}
            style={{
                backgroundImage: hasCustomBg
                    ? `radial-gradient(circle, ${bgGradients.color1} 0%, ${bgGradients.color2} 100%)`
                    : undefined,
            }}
        >
            {isLoading && (
                <div className="hall-empty">
                    <Loader color="gold" type="dots" />
                </div>
            )}

            {!isLoading && isEmpty && (
                <div className="hall-empty">
                    <Paper className="hall-empty-card" radius="xl" p="xl">
                        <Stack align="center" gap="xs" ta="center">
                            <RingsWreath size={120} />
                            <Text className="hall-empty-title">{t('empty_title')}</Text>
                            <Flourish width={160} />
                            <Text size="sm" c="dimmed" maw={280}>{t(readOnly ? 'empty_text_couple' : 'empty_text')}</Text>
                        </Stack>
                    </Paper>
                </div>
            )}

            <div className="hall-sizer" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
                <div
                    className={`hall ${isArranging ? 'arranging' : ''}`}
                    style={{ width: canvasWidth, height: canvasHeight, transform: zoom !== 1 ? `scale(${zoom})` : undefined }}
                >
                    {/* Bigger elements first, so smaller ones (DJ on the stage, cake on the dance floor) stay on top */}
                    {[...elements].sort((a, b) => b.w * b.h - a.w * a.h).map(element => (
                        <ElementItem
                            key={element.id}
                            element={element}
                            zoom={zoom}
                            readOnly={readOnly}
                            onMove={store.moveElement}
                            onResize={store.resizeElement}
                            onSetSize={store.setElementSize}
                            onSetShape={store.setElementShape}
                            onRotate={store.rotateElement}
                            onRename={onRenameElement}
                            onDelete={store.deleteElement}
                        />
                    ))}

                    {tables.map(table => {
                        const tableSeats: (Guest | undefined)[] = Array.from({ length: table.capacity }, (_, i) =>
                            seats.get(seatKey(table.id, i)),
                        );
                        return (
                            <TableItem
                                key={table.id}
                                table={table}
                                index={tableNumber(tables, table) - 1}
                                seats={tableSeats}
                                groupColors={groupColors}
                                matchIds={matchIds}
                                zoom={zoom}
                                readOnly={readOnly}
                                onOpenDetails={onOpenDetails}
                                onDropGuest={onDropGuest}
                                updateTableCapacity={store.setCapacity}
                                updateTablePosition={store.moveTable}
                                deleteTable={store.deleteTable}
                                rotateTable={store.rotateTable}
                                updateTableSize={store.resizeTable}
                                onEditTableName={onEditTableName}
                                onEditGuest={onEditGuest}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default Hall;
