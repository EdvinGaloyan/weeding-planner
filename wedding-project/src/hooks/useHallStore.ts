import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client.ts';
import { MIN_ELEMENT_SIZE } from '../utils/elements.ts';
import { ElementShape, EMPTY_GRADIENT, EMPTY_HALL, Gradient, Guest, GuestGroup, HallData, HallElement, TableData } from '../types/types.ts';
import { readJSON, writeJSON } from '../utils/storage.ts';
import { hallSnapshot, normalizeHall } from '../utils/validation.ts';
import { tableSize } from '../utils/seating.ts';
import { autoSeat, newId, reconcileSeats, seatIndex, seatKey, unseat } from '../utils/guests.ts';

/** Where a hall comes from and goes to: an event of the venue, or the couple's share link. */
export interface HallSource {
    draftKey: string;
    load: (signal?: AbortSignal) => Promise<{ hall: HallData; version: number }>;
    save: (hall: HallData, version: number, force: boolean) => Promise<{ version: number }>;
}

/**
 * Local draft kept in localStorage.
 *  - `hall`: the latest state of the hall (written on every change, debounced)
 *  - `syncedSnapshot`: the hall as it was last loaded from / saved to the server,
 *    so we know whether the draft contains changes the server doesn't have.
 */
interface Draft {
    version: 2;
    hall: HallData;
    syncedSnapshot: string | null;
    serverVersion: number;
    updatedAt: number;
}

const AUTOSAVE_LOCAL_DELAY = 250;
const AUTOSAVE_SERVER_DELAY = 1500;
const OFFLINE_RETRY_DELAY = 15000;
const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

function isDraft(value: unknown): value is Draft {
    if (typeof value !== 'object' || value === null) return false;
    const draft = value as Partial<Draft>;
    if (draft.version !== 2 || typeof draft.serverVersion !== 'number') return false;
    if (draft.syncedSnapshot !== null && typeof draft.syncedSnapshot !== 'string') return false;
    const hall = normalizeHall(draft.hall);
    if (!hall) return false;
    draft.hall = hall; // keep the cleaned-up version
    return true;
}

const hasContent = (hall: HallData) => hall.tables.length > 0 || hall.guests.length > 0 || hall.elements.length > 0;

/** True when the draft holds edits that were never saved to the server. */
function draftHasUnsavedChanges(draft: Draft | null): draft is Draft {
    if (!draft) return false;
    if (draft.syncedSnapshot === null) return hasContent(draft.hall);
    return hallSnapshot(draft.hall) !== draft.syncedSnapshot;
}

export type LoadStatus = 'loading' | 'ready' | 'offline' | 'conflict' | 'error';
export type LoadOutcome = 'server' | 'restored-draft' | 'offline-draft' | 'offline-empty' | 'not-found' | 'unauthorized';

interface Options {
    source: HallSource;
    /** Called once the initial load is resolved, so the UI can show a message. */
    onLoaded?: (outcome: LoadOutcome) => void;
    /** Couple mode: the layout is read-only, only guests can change. Autosave on by default. */
    autosave?: boolean;
}

export function useHallStore({ source, onLoaded, autosave = true }: Options) {
    // Read the draft once, synchronously, so the hall shows instantly on refresh
    const [initialDraft] = useState(() => readJSON(source.draftKey, isDraft));
    const [hall, setHallState] = useState<HallData>(() => initialDraft?.hall ?? EMPTY_HALL);
    const hallRef = useRef(hall);
    const [syncedSnapshot, setSyncedSnapshot] = useState<string | null>(() => initialDraft?.syncedSnapshot ?? null);
    const [serverVersion, setServerVersion] = useState(() => initialDraft?.serverVersion ?? 0);
    const [status, setStatus] = useState<LoadStatus>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [historyTick, setHistoryTick] = useState(0);

    const history = useRef({ past: [] as HallData[], future: [] as HallData[], lastKey: '', lastTime: 0 });
    const userEditedDuringLoad = useRef(false);
    const onLoadedRef = useRef(onLoaded);
    onLoadedRef.current = onLoaded;

    const snapshot = useMemo(() => hallSnapshot(hall), [hall]);
    const isDirty = syncedSnapshot === null ? hasContent(hall) : snapshot !== syncedSnapshot;

    const replaceHall = useCallback((next: HallData) => {
        hallRef.current = next;
        setHallState(next);
    }, []);

    // ---- Initial load: server vs local draft -----------------------------------
    const loadFromServer = useCallback(
        async (signal?: AbortSignal, { preferDraft }: { preferDraft: boolean } = { preferDraft: true }) => {
            try {
                const { hall: serverHall, version } = await source.load(signal);
                const serverSnapshot = hallSnapshot(serverHall);
                const keepLocal =
                    preferDraft &&
                    (userEditedDuringLoad.current ||
                        (draftHasUnsavedChanges(initialDraft) && hallSnapshot(initialDraft.hall) !== serverSnapshot));

                if (!keepLocal) {
                    replaceHall(serverHall);
                    history.current = { past: [], future: [], lastKey: '', lastTime: 0 };
                    setHistoryTick(x => x + 1);
                }
                setSyncedSnapshot(serverSnapshot);
                setServerVersion(version);
                setStatus('ready');
                onLoadedRef.current?.(keepLocal ? 'restored-draft' : 'server');
            } catch (error) {
                if (signal?.aborted) return;
                if (error instanceof ApiError && (error.status === 404 || error.status === 401)) {
                    setStatus('error');
                    onLoadedRef.current?.(error.status === 404 ? 'not-found' : 'unauthorized');
                    return;
                }
                console.error('Failed to load hall from server:', error);
                setStatus('offline');
                onLoadedRef.current?.(initialDraft ? 'offline-draft' : 'offline-empty');
            }
        },
        [initialDraft, replaceHall, source],
    );

    useEffect(() => {
        const controller = new AbortController();
        loadFromServer(controller.signal);
        return () => controller.abort(); // StrictMode runs effects twice — cancel the first request
    }, [loadFromServer]);

    /** Throws away local edits and shows the server version. */
    const discardLocalChanges = useCallback(() => {
        userEditedDuringLoad.current = false;
        return loadFromServer(undefined, { preferDraft: false });
    }, [loadFromServer]);

    // ---- Autosave the draft to localStorage --------------------------------------
    const latestDraft = useRef<Draft | null>(null);
    latestDraft.current =
        status === 'loading' || status === 'error'
            ? null
            : { version: 2, hall, syncedSnapshot, serverVersion, updatedAt: Date.now() };

    useEffect(() => {
        // Don't write until the initial load is resolved, otherwise an empty
        // placeholder could overwrite a good draft.
        if (status === 'loading' || status === 'error') return;
        const timer = window.setTimeout(() => writeJSON(source.draftKey, latestDraft.current), AUTOSAVE_LOCAL_DELAY);
        return () => window.clearTimeout(timer);
    }, [hall, syncedSnapshot, serverVersion, status, source.draftKey]);

    // Flush immediately when the tab is closed/refreshed (the debounce may not have fired yet)
    useEffect(() => {
        const flush = () => {
            if (latestDraft.current) writeJSON(source.draftKey, latestDraft.current);
        };
        window.addEventListener('pagehide', flush);
        return () => window.removeEventListener('pagehide', flush);
    }, [source.draftKey]);

    // ---- Server save ----------------------------------------------------------------
    const savingRef = useRef(false);
    const save = useCallback(
        async (force = false) => {
            if (savingRef.current) return false;
            savingRef.current = true;
            setIsSaving(true);
            const savedHall = hallRef.current;
            const savedSnapshot = hallSnapshot(savedHall); // edits made while saving stay "unsaved"
            try {
                const { version } = await source.save(savedHall, serverVersion, force);
                setSyncedSnapshot(savedSnapshot);
                setServerVersion(version);
                setStatus('ready');
                return true;
            } catch (error) {
                console.error('Failed to save hall:', error);
                if (error instanceof ApiError && error.status === 409) setStatus('conflict');
                else if (error instanceof ApiError && error.message === 'offline') setStatus('offline');
                return false;
            } finally {
                savingRef.current = false;
                setIsSaving(false);
            }
        },
        [serverVersion, source],
    );

    // Saves to the server shortly after the last edit (and retries while offline)
    useEffect(() => {
        if (!autosave || !isDirty || isSaving) return;
        if (status !== 'ready' && status !== 'offline') return;
        const timer = window.setTimeout(() => save(), status === 'offline' ? OFFLINE_RETRY_DELAY : AUTOSAVE_SERVER_DELAY);
        return () => window.clearTimeout(timer);
    }, [autosave, isDirty, isSaving, status, snapshot, save]);

    /** Resolves a save conflict: keep my version (overwrite) or take the server's. */
    const resolveConflict = useCallback(
        (choice: 'mine' | 'theirs') => (choice === 'mine' ? save(true) : discardLocalChanges()),
        [discardLocalChanges, save],
    );

    // ---- History (undo / redo) --------------------------------------------------------
    /**
     * Every change goes through here. Changes with the same `coalesceKey` that follow each other
     * quickly (dragging the rotation handle, repeated +/- clicks) become one undo step.
     */
    const updateHall = useCallback(
        (recipe: (prev: HallData) => HallData, coalesceKey = '') => {
            const prev = hallRef.current;
            const next = recipe(prev);
            if (next === prev) return;
            userEditedDuringLoad.current = true;

            const h = history.current;
            const now = Date.now();
            if (!(coalesceKey && coalesceKey === h.lastKey && now - h.lastTime < COALESCE_MS)) {
                h.past.push(prev);
                if (h.past.length > HISTORY_LIMIT) h.past.shift();
            }
            h.lastKey = coalesceKey;
            h.lastTime = now;
            h.future = [];
            replaceHall(next);
            setHistoryTick(x => x + 1);
        },
        [replaceHall],
    );

    const undo = useCallback(() => {
        const h = history.current;
        const prev = h.past.pop();
        if (!prev) return;
        h.future.push(hallRef.current);
        h.lastKey = '';
        replaceHall(prev);
        setHistoryTick(x => x + 1);
    }, [replaceHall]);

    const redo = useCallback(() => {
        const h = history.current;
        const next = h.future.pop();
        if (!next) return;
        h.past.push(hallRef.current);
        h.lastKey = '';
        replaceHall(next);
        setHistoryTick(x => x + 1);
    }, [replaceHall]);

    // ---- Mutations -------------------------------------------------------------------
    const actions = useMemo(() => {
        const withTables = (prev: HallData, tables: TableData[]): HallData => ({
            ...prev,
            tables,
            guests: reconcileSeats(prev.guests, tables),
        });

        const setTables = (recipe: TableData[] | ((prev: TableData[]) => TableData[]), key?: string) =>
            updateHall(prev => withTables(prev, typeof recipe === 'function' ? recipe(prev.tables) : recipe), key);

        const patchTable = (id: number, patch: (table: TableData) => Partial<TableData>, key?: string) =>
            setTables(prev => prev.map(table => (table.id === id ? { ...table, ...patch(table) } : table)), key);

        const setGuests = (recipe: (prev: Guest[]) => Guest[], key?: string) =>
            updateHall(prev => ({ ...prev, guests: recipe(prev.guests) }), key);

        const patchElement = (id: number, patch: (element: HallElement) => Partial<HallElement>, key?: string) =>
            updateHall(
                prev => ({ ...prev, elements: prev.elements.map(e => (e.id === id ? { ...e, ...patch(e) } : e)) }),
                key,
            );

        return {
            // Tables
            setTables,
            addTables: (newTables: TableData[]) => setTables(prev => [...prev, ...newTables]),
            deleteTable: (id: number) => setTables(prev => prev.filter(table => table.id !== id)),
            clearTables: () => setTables([]),
            moveTable: (id: number, x: number, y: number) => patchTable(id, () => ({ x: Math.round(x), y: Math.round(y) })),
            rotateTable: (id: number, angle: number) =>
                patchTable(id, table => (table.shape === 'rect' ? { rotation: angle } : {}), `rotate-${id}`),
            resizeTable: (id: number, delta: number) =>
                patchTable(id, table => ({ customSize: Math.max(100, tableSize(table) + delta) }), `resize-${id}`),
            setCapacity: (id: number, capacity: number) =>
                patchTable(
                    id,
                    table => (table.isHeadTable ? {} : { capacity: Math.max(1, Math.min(60, Math.round(capacity))) }),
                    `capacity-${id}`,
                ),
            renameTable: (id: number, name: string) => patchTable(id, () => ({ tableName: name.trim() || undefined })),

            // Guests
            addGuests: (list: Omit<Guest, 'id'>[]) => {
                const created = list.map(guest => ({ ...guest, id: newId() }));
                setGuests(prev => [...prev, ...created]);
                return created.map(guest => guest.id);
            },
            updateGuest: (id: string, patch: Partial<Omit<Guest, 'id'>>) =>
                setGuests(prev => prev.map(guest => (guest.id === id ? { ...guest, ...patch } : guest))),
            deleteGuest: (id: string) => setGuests(prev => prev.filter(guest => guest.id !== id)),
            deleteGuests: (ids: string[]) => {
                const remove = new Set(ids);
                setGuests(prev => prev.filter(guest => !remove.has(guest.id)));
            },
            /** Puts a guest on a chair; whoever sat there moves to the guest's previous chair (or stands up). */
            seatGuest: (guestId: string, tableId: number, seat: number) =>
                setGuests(prev => {
                    const mover = prev.find(guest => guest.id === guestId);
                    if (!mover) return prev;
                    const occupant = seatIndex(prev).get(seatKey(tableId, seat));
                    if (occupant?.id === guestId) return prev;
                    return prev.map(guest => {
                        if (guest.id === guestId) return { ...guest, tableId, seat };
                        if (occupant && guest.id === occupant.id) {
                            return mover.tableId !== undefined && mover.seat !== undefined
                                ? { ...guest, tableId: mover.tableId, seat: mover.seat }
                                : unseat(guest);
                        }
                        return guest;
                    });
                }),
            unseatGuest: (id: string) => setGuests(prev => prev.map(guest => (guest.id === id ? unseat(guest) : guest))),
            unseatAll: () => setGuests(prev => prev.map(unseat)),
            autoSeat: () => updateHall(prev => ({ ...prev, guests: autoSeat(prev) })),

            // Groups
            addGroup: (name: string, color: string) => {
                const id = newId();
                updateHall(prev => ({ ...prev, groups: [...prev.groups, { id, name: name.trim(), color }] }));
                return id;
            },
            setGroups: (groups: GuestGroup[]) => updateHall(prev => ({ ...prev, groups })),
            updateGroup: (id: string, patch: Partial<Omit<GuestGroup, 'id'>>) =>
                updateHall(prev => ({ ...prev, groups: prev.groups.map(g => (g.id === id ? { ...g, ...patch } : g)) })),
            deleteGroup: (id: string) =>
                updateHall(prev => ({
                    ...prev,
                    groups: prev.groups.filter(g => g.id !== id),
                    guests: prev.guests.map(guest => {
                        if (guest.groupId !== id) return guest;
                        const { groupId: _groupId, ...rest } = guest;
                        return rest;
                    }),
                })),

            // Hall elements
            addElement: (element: HallElement) => updateHall(prev => ({ ...prev, elements: [...prev.elements, element] })),
            moveElement: (id: number, x: number, y: number) => patchElement(id, () => ({ x: Math.round(x), y: Math.round(y) })),
            resizeElement: (id: number, factor: number) =>
                patchElement(
                    id,
                    e => ({ w: Math.max(30, Math.round(e.w * factor)), h: Math.max(30, Math.round(e.h * factor)) }),
                    `el-resize-${id}`,
                ),
            /** Free resize from the handles: width and height change independently. */
            setElementSize: (id: number, w: number, h: number) =>
                patchElement(
                    id,
                    () => ({ w: Math.max(MIN_ELEMENT_SIZE, Math.round(w)), h: Math.max(MIN_ELEMENT_SIZE, Math.round(h)) }),
                    `el-size-${id}`,
                ),
            setElementShape: (id: number, shape: ElementShape) => patchElement(id, () => ({ shape })),
            rotateElement: (id: number) => patchElement(id, e => ({ rotation: (e.rotation + 90) % 360 })),
            renameElement: (id: number, label: string) => patchElement(id, () => ({ label: label.trim() || undefined })),
            deleteElement: (id: number) => updateHall(prev => ({ ...prev, elements: prev.elements.filter(e => e.id !== id) })),

            // Background
            setGradient: (gradient: Gradient) => updateHall(prev => ({ ...prev, bgGradients: gradient }), 'gradient'),
            setGradientColor: (key: keyof Gradient, value: string) =>
                updateHall(prev => ({ ...prev, bgGradients: { ...prev.bgGradients, [key]: value } }), 'gradient'),
            resetGradient: () => updateHall(prev => ({ ...prev, bgGradients: EMPTY_GRADIENT })),
        };
    }, [updateHall]);

    void historyTick; // re-render when the history changes so canUndo/canRedo are fresh
    const canUndo = history.current.past.length > 0;
    const canRedo = history.current.future.length > 0;

    return {
        hall,
        status,
        isDirty,
        isSaving,
        save,
        discardLocalChanges,
        resolveConflict,
        undo,
        redo,
        canUndo,
        canRedo,
        ...actions,
    };
}

export type HallStore = ReturnType<typeof useHallStore>;

/** Creates `count` numeric ids (tables, elements) that never collide with existing ones. */
export function nextTableIds(existing: { id: number }[], count: number): number[] {
    const start = Math.max(Date.now(), ...existing.map(item => item.id + 1));
    return Array.from({ length: count }, (_, i) => start + i);
}
