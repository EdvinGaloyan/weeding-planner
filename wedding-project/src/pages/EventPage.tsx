import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCloudOff, IconHistory } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api/endpoints.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { HallSource, LoadOutcome, useHallStore } from '../hooks/useHallStore.ts';
import { navigate, routeUrl } from '../hooks/useHashRoute.ts';
import { readJSON, writeJSON } from '../utils/storage.ts';
import Editor from '../components/Editor';
import EventFormModal from '../components/EventFormModal';
import { RingsWreath } from '../components/Illustrations';

interface EventMeta {
    title: string;
    date: string;
    shareToken: string;
    lookupToken: string;
}

const isMeta = (value: unknown): value is EventMeta =>
    typeof value === 'object' && value !== null && typeof (value as EventMeta).title === 'string';

/** Shows a message once the hall is loaded (restored draft, offline…). */
export function useLoadNotifications(discardRef: React.RefObject<() => void>) {
    const { t } = useTranslation();
    return useCallback(
        (outcome: LoadOutcome) => {
            if (outcome === 'restored-draft') {
                notifications.show({
                    id: 'restored-draft',
                    color: 'gold',
                    icon: <IconHistory size={18} />,
                    title: t('draft_restored_title'),
                    autoClose: 12000,
                    message: (
                        <Stack gap={6} align="flex-start">
                            <Text size="sm">{t('draft_restored_text')}</Text>
                            <Button
                                size="compact-xs"
                                variant="light"
                                color="gray"
                                onClick={() => {
                                    notifications.hide('restored-draft');
                                    discardRef.current();
                                }}
                            >
                                {t('btn_load_server_version')}
                            </Button>
                        </Stack>
                    ),
                });
            } else if (outcome === 'offline-draft' || outcome === 'offline-empty') {
                notifications.show({
                    id: 'load-failed',
                    color: 'red',
                    icon: <IconCloudOff size={18} />,
                    title: t('load_failed'),
                    message: outcome === 'offline-draft' ? t('showing_local_copy') : t('server_off'),
                });
            }
        },
        [discardRef, t],
    );
}

export function NotFound({ onBack }: { onBack?: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="auth-page">
            <Stack align="center" gap="sm" ta="center" className="auth-card" p="xl">
                <RingsWreath size={100} />
                <Text className="auth-title">{t('not_found_title')}</Text>
                <Text size="sm" c="dimmed" maw={320}>{t('not_found_text')}</Text>
                {onBack && <Button onClick={onBack}>{t('all_events')}</Button>}
            </Stack>
        </div>
    );
}

function EventPage({ id }: { id: string }) {
    const { t } = useTranslation();
    const { venue } = useAuth();
    const metaKey = `event-meta:${id}`;
    const [meta, setMeta] = useState<EventMeta | null>(() => readJSON(metaKey, isMeta));
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const discardRef = useRef<() => void>(() => {});

    const rememberMeta = useCallback(
        (next: EventMeta) => {
            setMeta(next);
            writeJSON(metaKey, next);
        },
        [metaKey],
    );

    const source = useMemo<HallSource>(
        () => ({
            draftKey: `event-draft:${id}`,
            load: async signal => {
                const event = await api.fetchEvent(id, signal);
                rememberMeta({ title: event.title, date: event.date, shareToken: event.shareToken, lookupToken: event.lookupToken });
                return { hall: event.hall, version: event.version };
            },
            save: (hall, version, force) => api.saveEvent(id, { hall, version, force }),
        }),
        [id, rememberMeta],
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

    if (notFound) return <NotFound onBack={() => navigate('/')} />;

    const back = () => {
        // Make sure the last edits reach the server before leaving
        if (store.isDirty) store.save();
        navigate('/');
    };

    return (
        <>
            <Editor
                store={store}
                mode="venue"
                event={{ title: meta?.title || '', date: meta?.date || '' }}
                venue={venue}
                onBack={back}
                onEditEvent={meta ? () => setIsEditOpen(true) : undefined}
                share={
                    meta?.shareToken
                        ? {
                              coupleUrl: routeUrl(`/share/${meta.shareToken}`),
                              lookupUrl: routeUrl(`/find/${meta.lookupToken}`),
                              onRotate: async () => {
                                  try {
                                      const { shareToken } = await api.rotateShareLink(id);
                                      rememberMeta({ ...meta, shareToken });
                                  } catch {
                                      notifications.show({ color: 'red', message: t('save_failed') });
                                  }
                              },
                          }
                        : undefined
                }
                onSaveTemplate={async name => {
                    const { tables, elements, bgGradients } = store.hall;
                    await api.createTemplate(name, { tables, elements, bgGradients });
                }}
            />
            {meta && (
                <EventFormModal
                    opened={isEditOpen}
                    onClose={() => setIsEditOpen(false)}
                    initial={{ title: meta.title, date: meta.date }}
                    onSubmit={async ({ title, date }) => {
                        try {
                            await api.saveEvent(id, { title, date });
                            rememberMeta({ ...meta, title, date });
                        } catch {
                            notifications.show({ color: 'red', message: t('save_failed') });
                        }
                    }}
                />
            )}
        </>
    );
}

export default EventPage;
