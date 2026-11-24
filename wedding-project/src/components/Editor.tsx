import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
    IconAlertTriangle,
    IconArrowBackUp,
    IconArrowForwardUp,
    IconCheck,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand,
    IconMaximize,
    IconPrinter,
    IconShare,
    IconUsers,
    IconX,
    IconZoomIn,
    IconZoomOut,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Hall from './Hall';
import NameModal from './NameModal';
import PlannerModal from './PlannerModal';
import TableDetailModal from './TableDetailModal';
import GuestPanel from './GuestPanel';
import GuestModal, { GuestTarget } from './GuestModal';
import ImportModal from './ImportModal';
import PrintModal from './PrintModal';
import ShareModal from './ShareModal';
import { ElementKind, Guest, TableData, TableShapeKind, Venue } from '../types/types.ts';
import { arrangeTables, LayoutOrientation, tableDimensions } from '../utils/seating.ts';
import { HEAD_SEATS } from '../utils/chairs.ts';
import { newElement } from '../utils/elements.ts';
import { matchesQuery, seatIndex, seatKey } from '../utils/guests.ts';
import { tableLabel } from '../utils/labels.ts';
import { HallStore, nextTableIds } from '../hooks/useHallStore.ts';
import { isBoolean, usePersistentState } from '../hooks/usePersistentState.ts';

type NameTarget =
    | { kind: 'table'; tableId: number; label: string }
    | { kind: 'element'; elementId: number; label: string }
    | { kind: 'template' };

export interface EditorProps {
    store: HallStore;
    mode: 'venue' | 'couple';
    event: { title: string; date: string };
    venue: Venue | null;
    onBack?: () => void;
    onEditEvent?: () => void;
    share?: { coupleUrl: string; lookupUrl: string; onRotate: () => Promise<void> };
    onSaveTemplate?: (name: string) => Promise<void>;
}

const ARRANGE_ANIMATION_MS = 900;
/** Must match $sidebar-width and the guest panel width in App.scss. */
const SIDEBAR_WIDTH = 330;
const GUEST_PANEL_WIDTH = 340;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 1.6;

const isOrientation = (value: unknown): value is LayoutOrientation => value === 'horizontal' || value === 'vertical';
const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 900;
const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function Editor({ store, mode, event, venue, onBack, onEditEvent, share, onSaveTemplate }: EditorProps) {
    const { t } = useTranslation();
    const { hall } = store;
    const { tables } = hall;
    const readOnly = mode === 'couple';

    // UI-only state (preferences are remembered between visits)
    // Phones keep their own preferences (both panels start closed and only one is open at a time)
    const [narrow] = useState(isNarrow);
    const suffix = narrow ? '-mobile' : '';
    const [isSidebarOpen, setSidebarOpenState] = usePersistentState(`sidebar-open${suffix}`, !narrow, isBoolean);
    const [isGuestPanelOpen, setGuestPanelOpenState] = usePersistentState(`guest-panel-open${suffix}`, !narrow, isBoolean);
    const setIsSidebarOpen = (update: (open: boolean) => boolean) => {
        const next = update(isSidebarOpen);
        setSidebarOpenState(next);
        if (next && narrow) setGuestPanelOpenState(false);
    };
    const setIsGuestPanelOpen = (update: (open: boolean) => boolean) => {
        const next = update(isGuestPanelOpen);
        setGuestPanelOpenState(next);
        if (next && narrow) setSidebarOpenState(false);
    };
    const [orientation, setOrientation] = usePersistentState<LayoutOrientation>('layout-orientation', 'horizontal', isOrientation);
    const [zoom, setZoom] = useState(1);
    const [addCount, setAddCount] = useState(1);
    const [selectedShape, setSelectedShape] = useState<TableShapeKind>('round');
    const [isHeadTable, setIsHeadTable] = useState(false);
    const [nameTarget, setNameTarget] = useState<NameTarget | null>(null);
    const [guestTarget, setGuestTarget] = useState<GuestTarget | null>(null);
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [detailTableId, setDetailTableId] = useState<number | null>(null);
    const [isArranging, setIsArranging] = useState(false);
    const [query, setQuery] = useState('');
    const viewportRef = useRef<HTMLDivElement>(null);
    const arrangeTimer = useRef<number | undefined>(undefined);

    const labelFor = useCallback((table: TableData) => tableLabel(t, tables, table), [t, tables]);
    const labelForId = useCallback(
        (tableId: number) => {
            const table = tables.find(tbl => tbl.id === tableId);
            return table ? labelFor(table) : '—';
        },
        [labelFor, tables],
    );

    const matchIds = useMemo(
        () => new Set(query.trim().length >= 2 ? hall.guests.filter(guest => matchesQuery(guest, query)).map(g => g.id) : []),
        [hall.guests, query],
    );

    // ---- Zoom -----------------------------------------------------------------------
    const contentSize = useCallback(() => {
        let right = 0;
        let bottom = 0;
        tables.forEach(table => {
            const { size, height } = tableDimensions(table);
            right = Math.max(right, table.x + size + 60);
            bottom = Math.max(bottom, table.y + height + 90);
        });
        hall.elements.forEach(e => {
            right = Math.max(right, e.x + e.w + 30);
            bottom = Math.max(bottom, e.y + e.h + 30);
        });
        return { right, bottom };
    }, [hall.elements, tables]);

    /**
     * The side panels float over the hall. On desktop the drawing is shifted right while the
     * menu is open, and the guest panel covers the right edge — this is the part left visible.
     */
    const visibleWidth = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return 0;
        const left = !narrow && isSidebarOpen ? SIDEBAR_WIDTH : 0;
        const right = !narrow && isGuestPanelOpen ? GUEST_PANEL_WIDTH : 0;
        return Math.max(200, viewport.clientWidth - left - right);
    }, [isGuestPanelOpen, isSidebarOpen, narrow]);

    // The canvas size follows the panels only after their slide has finished, so the hall
    // is not re-rendered in the middle of the animation.
    const targetCovered = narrow ? 0 : (isSidebarOpen ? SIDEBAR_WIDTH : 0) + (isGuestPanelOpen ? GUEST_PANEL_WIDTH : 0);
    const [coveredWidth, setCoveredWidth] = useState(targetCovered);
    useEffect(() => {
        const timer = window.setTimeout(() => setCoveredWidth(targetCovered), 400);
        return () => window.clearTimeout(timer);
    }, [targetCovered]);

    const fitToScreen = useCallback(() => {
        const viewport = viewportRef.current;
        const { right, bottom } = contentSize();
        if (!viewport || !right || !bottom) return setZoom(1);
        const fit = Math.min(visibleWidth() / right, viewport.clientHeight / bottom, 1);
        setZoom(Math.max(ZOOM_MIN, Math.round(fit * 100) / 100));
        viewport.scrollTo({ left: 0, top: 0 });
    }, [contentSize, visibleWidth]);

    const changeZoom = (delta: number) => setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 10) / 10)));

    // Small screens open with the whole hall in view
    const didAutoFit = useRef(false);
    useEffect(() => {
        if (didAutoFit.current || store.status === 'loading' || !isNarrow()) return;
        didAutoFit.current = true;
        fitToScreen();
    }, [fitToScreen, store.status]);

    /** Centre of what is currently visible, in hall coordinates (new items appear there). */
    const visibleCenter = () => {
        const viewport = viewportRef.current;
        if (!viewport) return { x: 300, y: 250 };
        return {
            x: (viewport.scrollLeft + visibleWidth() / 2) / zoom,
            y: (viewport.scrollTop + viewport.clientHeight / 2) / zoom,
        };
    };

    // ---- Keyboard shortcuts ---------------------------------------------------------
    const { undo, redo } = store;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo]);

    // ---- Save conflict (edited elsewhere in the meantime) -------------------------------
    const { resolveConflict } = store;
    useEffect(() => {
        if (store.status !== 'conflict') return;
        notifications.show({
            id: 'conflict',
            color: 'red',
            autoClose: false,
            withCloseButton: false,
            icon: <IconAlertTriangle size={18} />,
            title: t('conflict_title'),
            message: (
                <Stack gap={6} align="flex-start">
                    <Text size="sm">{t('conflict_text')}</Text>
                    <Group gap={6}>
                        <Button
                            size="compact-xs"
                            variant="light"
                            onClick={() => {
                                notifications.hide('conflict');
                                resolveConflict('theirs');
                            }}
                        >
                            {t('conflict_theirs')}
                        </Button>
                        <Button
                            size="compact-xs"
                            variant="subtle"
                            color="red"
                            onClick={() => {
                                notifications.hide('conflict');
                                resolveConflict('mine');
                            }}
                        >
                            {t('conflict_mine')}
                        </Button>
                    </Group>
                </Stack>
            ),
        });
    }, [resolveConflict, store.status, t]);

    // ---- Layout -------------------------------------------------------------------
    /** Lays the given tables out inside the visible hall and animates them into place. */
    const applyArrangement = (source: TableData[], layout: LayoutOrientation = orientation) => {
        const viewport = viewportRef.current;
        const arranged = viewport
            ? arrangeTables(source, visibleWidth() / zoom, viewport.clientHeight / zoom, layout)
            : source;
        window.clearTimeout(arrangeTimer.current);
        setIsArranging(true);
        arrangeTimer.current = window.setTimeout(() => setIsArranging(false), ARRANGE_ANIMATION_MS);
        viewport?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
        store.setTables(arranged);
    };

    const handleArrange = (layout: LayoutOrientation = orientation) => {
        applyArrangement(tables, layout);
        notifications.show({ id: 'arranged', color: 'blush', icon: <IconCheck size={18} />, message: t('arranged_ok') });
    };

    /** Switching orientation re-arranges the hall right away so the change is visible. */
    const handleOrientationChange = (layout: LayoutOrientation) => {
        setOrientation(layout);
        if (tables.length) handleArrange(layout);
    };

    const handleCreateFromPlan = (newTables: TableData[], replace: boolean) => {
        applyArrangement(replace ? newTables : [...tables, ...newTables]);
        const seats = newTables.reduce((sum, table) => sum + table.capacity, 0);
        notifications.show({
            color: 'blush',
            icon: <IconCheck size={18} />,
            message: t('created_ok', { count: newTables.length, guests: seats }),
        });
    };

    // ---- Server save ------------------------------------------------------------------
    const handleSave = async () => {
        const ok = await store.save();
        notifications.show(
            ok
                ? { color: 'sage', icon: <IconCheck size={18} />, title: '🎉', message: t('saved_ok') }
                : { color: 'red', icon: <IconX size={18} />, title: t('save_failed'), message: t('server_off_local_kept') },
        );
    };

    // ---- Table & element actions ----------------------------------------------------------
    const addTables = () => {
        if (isHeadTable && tables.some(table => table.isHeadTable)) {
            notifications.show({ color: 'gold', message: t('head_only_one') });
            return;
        }
        const count = isHeadTable ? 1 : addCount;
        const ids = nextTableIds([...tables, ...hall.elements], count);
        const center = visibleCenter();
        const newTables: TableData[] = ids.map((id, i) => ({
            id,
            capacity: isHeadTable ? HEAD_SEATS : 12,
            shape: isHeadTable ? 'rect' : selectedShape,
            x: Math.max(20, Math.round(center.x - 90 + i * 30)),
            y: Math.max(20, Math.round(center.y - 90 + i * 30)),
            isHeadTable,
            rotation: selectedShape === 'rect' && !isHeadTable ? 90 : 0,
        }));
        store.addTables(newTables);
        setIsHeadTable(false);
    };

    const addElement = (kind: ElementKind) => {
        const [id] = nextTableIds([...tables, ...hall.elements], 1);
        const center = visibleCenter();
        const element = newElement(kind, id, center.x, center.y);
        store.addElement({ ...element, x: Math.max(10, element.x), y: Math.max(10, element.y) });
    };

    const deleteAllTables = () => {
        modals.openConfirmModal({
            title: <Text className="modal-title">{t('confirm_delete_all_title')}</Text>,
            children: <Text size="sm" c="dimmed">{t('confirm_delete_all_text')}</Text>,
            labels: { confirm: t('btn_delete'), cancel: t('btn_cancel') },
            confirmProps: { color: 'red' },
            onConfirm: store.clearTables,
        });
    };

    // ---- Guests -------------------------------------------------------------------------
    const seats = useMemo(() => seatIndex(hall.guests), [hall.guests]);
    const groupColors = useMemo(() => new Map(hall.groups.map(group => [group.id, group.color])), [hall.groups]);

    const handleDropGuest = (tableId: number, seat: number | null, guestId: string) => {
        const table = tables.find(tbl => tbl.id === tableId);
        if (!table) return;
        const guest = hall.guests.find(g => g.id === guestId);
        let target = seat;
        if (target === null) {
            if (guest?.tableId === tableId) return; // dropped on its own table
            const free = Array.from({ length: table.capacity }, (_, i) => i).find(i => !seats.has(seatKey(tableId, i)));
            if (free === undefined) {
                notifications.show({ id: 'table-full', color: 'gold', message: t('table_full', { table: labelFor(table) }) });
                return;
            }
            target = free;
        }
        store.seatGuest(guestId, tableId, target);
    };

    const detailTable = detailTableId !== null ? tables.find(table => table.id === detailTableId) : undefined;
    const detailSeats: (Guest | undefined)[] = detailTable
        ? Array.from({ length: detailTable.capacity }, (_, i) => seats.get(seatKey(detailTable.id, i)))
        : [];
    const unseatedCount = hall.guests.filter(guest => guest.tableId === undefined).length;

    const nameModalProps = (() => {
        if (nameTarget?.kind === 'table') {
            const table = tables.find(tbl => tbl.id === nameTarget.tableId);
            return {
                title: t('edit_table_name'),
                label: t('table_name_label'),
                placeholder: t('table_name_placeholder'),
                initialValue: table?.tableName || nameTarget.label,
                onSave: (value: string) => store.renameTable(nameTarget.tableId, value),
            };
        }
        if (nameTarget?.kind === 'element') {
            return {
                title: t('element_name'),
                label: t('table_name_label'),
                placeholder: '',
                initialValue: nameTarget.label,
                onSave: (value: string) => store.renameElement(nameTarget.elementId, value),
            };
        }
        return {
            title: t('template_name_title'),
            subtitle: t('template_name_hint'),
            label: t('table_name_label'),
            placeholder: t('template_name_placeholder'),
            initialValue: '',
            onSave: async (value: string) => {
                if (!value || !onSaveTemplate) return;
                try {
                    await onSaveTemplate(value);
                    notifications.show({ color: 'sage', icon: <IconCheck size={18} />, message: t('template_saved') });
                } catch {
                    notifications.show({ color: 'red', message: t('save_failed') });
                }
            },
        };
    })();

    return (
        <div
            className={`app-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${isGuestPanelOpen ? 'guests-open' : ''} mode-${mode}`}
        >
            <Sidebar
                mode={mode}
                event={event}
                venue={venue}
                hall={hall}
                onBack={onBack}
                onEditEvent={onEditEvent}
                onSaveTemplate={onSaveTemplate ? () => setNameTarget({ kind: 'template' }) : undefined}
                addCount={addCount}
                setAddCount={setAddCount}
                selectedShape={selectedShape}
                setSelectedShape={setSelectedShape}
                addTables={addTables}
                addElement={addElement}
                isHeadTable={isHeadTable}
                setIsHeadTable={setIsHeadTable}
                deleteAllTables={deleteAllTables}
                onBgGradientChange={store.setGradientColor}
                onBgGradientSet={store.setGradient}
                onBgGradientReset={store.resetGradient}
                onSaveToServer={handleSave}
                isSaving={store.isSaving}
                isDirty={store.isDirty}
                loadStatus={store.status}
                onOpenPlanner={() => setIsPlannerOpen(true)}
                onArrange={() => handleArrange()}
                orientation={orientation}
                onOrientationChange={handleOrientationChange}
            />
            {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(() => false)} />}

            <Tooltip label={isSidebarOpen ? t('close_menu') : t('open_menu')} position="right">
                <ActionIcon
                    className="sidebar-toggle-btn"
                    variant="default"
                    size="lg"
                    radius="xl"
                    onClick={() => setIsSidebarOpen(open => !open)}
                    aria-label={isSidebarOpen ? t('close_menu') : t('open_menu')}
                >
                    {isSidebarOpen ? <IconLayoutSidebarLeftCollapse size={18} /> : <IconLayoutSidebarLeftExpand size={18} />}
                </ActionIcon>
            </Tooltip>

            <main className="hall-area">
                <Paper className="hall-toolbar" radius="xl" p={4}>
                    <Group gap={2} wrap="nowrap">
                        <Tooltip label={`${t('undo')} (Ctrl+Z)`}>
                            <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={undo} disabled={!store.canUndo} aria-label={t('undo')}>
                                <IconArrowBackUp size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={`${t('redo')} (Ctrl+Y)`}>
                            <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={redo} disabled={!store.canRedo} aria-label={t('redo')}>
                                <IconArrowForwardUp size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <span className="toolbar-sep" />
                        <Tooltip label={t('zoom_out')}>
                            <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={() => changeZoom(-0.1)} disabled={zoom <= ZOOM_MIN} aria-label={t('zoom_out')}>
                                <IconZoomOut size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('zoom_reset')}>
                            <button type="button" className="zoom-value" onClick={() => setZoom(1)}>
                                {Math.round(zoom * 100)}%
                            </button>
                        </Tooltip>
                        <Tooltip label={t('zoom_in')}>
                            <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={() => changeZoom(0.1)} disabled={zoom >= ZOOM_MAX} aria-label={t('zoom_in')}>
                                <IconZoomIn size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('zoom_fit')}>
                            <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={fitToScreen} aria-label={t('zoom_fit')}>
                                <IconMaximize size={18} />
                            </ActionIcon>
                        </Tooltip>
                        <span className="toolbar-sep" />
                        <Tooltip label={t('btn_print_menu')}>
                            <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={() => setIsPrintOpen(true)} aria-label={t('btn_print_menu')}>
                                <IconPrinter size={18} />
                            </ActionIcon>
                        </Tooltip>
                        {share && (
                            <Tooltip label={t('share_title')}>
                                <ActionIcon variant="subtle" color="wine" size="lg" radius="xl" onClick={() => setIsShareOpen(true)} aria-label={t('share_title')}>
                                    <IconShare size={18} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        <Button
                            size="sm"
                            radius="xl"
                            ml={4}
                            variant={isGuestPanelOpen ? 'filled' : 'light'}
                            color="blush"
                            leftSection={<IconUsers size={16} />}
                            rightSection={unseatedCount ? <Badge size="xs" color="gold" variant="filled" circle={unseatedCount < 10}>{unseatedCount}</Badge> : undefined}
                            onClick={() => setIsGuestPanelOpen(open => !open)}
                        >
                            <span className="toolbar-label">{t('guests_title')}</span>
                        </Button>
                    </Group>
                </Paper>

                <Hall
                    hall={hall}
                    store={store}
                    viewportRef={viewportRef}
                    zoom={zoom}
                    coveredWidth={coveredWidth}
                    readOnly={readOnly}
                    isArranging={isArranging}
                    isLoading={store.status === 'loading' && tables.length === 0}
                    matchIds={matchIds}
                    onEditTableName={(tableId, label) => setNameTarget({ kind: 'table', tableId, label })}
                    onEditGuest={(tableId, seat) => setGuestTarget({ kind: 'seat', tableId, seat })}
                    onOpenDetails={setDetailTableId}
                    onDropGuest={handleDropGuest}
                    onRenameElement={(elementId, label) => setNameTarget({ kind: 'element', elementId, label })}
                />
            </main>

            <GuestPanel
                open={isGuestPanelOpen}
                hall={hall}
                store={store}
                query={query}
                onQueryChange={setQuery}
                tableLabelFor={labelForId}
                onEditGuest={guestId => setGuestTarget({ kind: 'guest', guestId })}
                onOpenImport={() => setIsImportOpen(true)}
                onClose={() => setIsGuestPanelOpen(() => false)}
            />

            {/* Rendered before the other modals so those open on top of it */}
            <TableDetailModal
                table={detailTable}
                label={detailTable ? labelFor(detailTable) : ''}
                seats={detailSeats}
                groupColors={groupColors}
                onClose={() => setDetailTableId(null)}
                onEditGuest={seat => detailTable && setGuestTarget({ kind: 'seat', tableId: detailTable.id, seat })}
                onEditName={() => detailTable && setNameTarget({ kind: 'table', tableId: detailTable.id, label: labelFor(detailTable) })}
            />

            {!readOnly && (
                <PlannerModal
                    opened={isPlannerOpen}
                    onClose={() => setIsPlannerOpen(false)}
                    existingTables={tables}
                    seatedGuests={seats.size}
                    defaultGuests={hall.guests.length || 100}
                    onCreate={handleCreateFromPlan}
                />
            )}

            <ImportModal
                opened={isImportOpen}
                hall={hall}
                store={store}
                onClose={() => setIsImportOpen(false)}
                onImported={count =>
                    notifications.show({ color: 'sage', icon: <IconCheck size={18} />, message: t('imported_ok', { count }) })
                }
            />

            <PrintModal
                opened={isPrintOpen}
                onClose={() => setIsPrintOpen(false)}
                hall={hall}
                title={event.title}
                date={event.date}
                venue={venue}
                lookupUrl={share?.lookupUrl}
                tableLabelFor={labelForId}
            />

            {share && (
                <ShareModal
                    opened={isShareOpen}
                    onClose={() => setIsShareOpen(false)}
                    coupleUrl={share.coupleUrl}
                    lookupUrl={share.lookupUrl}
                    eventTitle={event.title}
                    onRotate={share.onRotate}
                />
            )}

            <GuestModal
                target={guestTarget}
                hall={hall}
                store={store}
                tableLabelFor={labelForId}
                onClose={() => setGuestTarget(null)}
            />

            <NameModal opened={!!nameTarget} onClose={() => setNameTarget(null)} {...nameModalProps} />
        </div>
    );
}

export default Editor;
