import { useMemo, useRef, useState } from 'react';
import * as api from '../api/endpoints.ts';
import { Venue } from '../types/types.ts';
import { HallSource, useHallStore } from '../hooks/useHallStore.ts';
import { readJSON, writeJSON } from '../utils/storage.ts';
import Editor from '../components/Editor';
import { NotFound, useLoadNotifications } from './EventPage';

interface ShareMeta {
    title: string;
    date: string;
    venue: Venue;
}

const isMeta = (value: unknown): value is ShareMeta =>
    typeof value === 'object' && value !== null && typeof (value as ShareMeta).title === 'string';

/** The couple's view: they manage guests and seating; the hall layout belongs to the venue. */
function SharePage({ token }: { token: string }) {
    const metaKey = `share-meta:${token}`;
    const [meta, setMeta] = useState<ShareMeta | null>(() => readJSON(metaKey, isMeta));
    const [notFound, setNotFound] = useState(false);
    const discardRef = useRef<() => void>(() => {});

    const source = useMemo<HallSource>(
        () => ({
            draftKey: `share-draft:${token}`,
            load: async signal => {
                const shared = await api.fetchShared(token, signal);
                const next = { title: shared.title, date: shared.date, venue: shared.venue };
                setMeta(next);
                writeJSON(metaKey, next);
                return { hall: shared.hall, version: shared.version };
            },
            save: (hall, version, force) => api.saveShared(token, hall, version, force),
        }),
        [metaKey, token],
    );

    const notify = useLoadNotifications(discardRef);
    const store = useHallStore({
        source,
        onLoaded: outcome => {
            if (outcome === 'not-found') setNotFound(true);
            notify(outcome);
        },
    });
    discardRef.current = store.discardLocalChanges;

    if (notFound) return <NotFound />;

    return (
        <Editor
            store={store}
            mode="couple"
            event={{ title: meta?.title || '', date: meta?.date || '' }}
            venue={meta?.venue || null}
        />
    );
}

export default SharePage;
