import { useCallback, useEffect, useState } from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Button,
    Card,
    Container,
    Group,
    Image,
    Loader,
    Menu,
    Progress,
    SimpleGrid,
    Stack,
    Text,
    Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
    IconCalendarEvent,
    IconCloudOff,
    IconDots,
    IconHistory,
    IconLogout,
    IconPlus,
    IconSettings,
    IconTemplate,
    IconTrash,
    IconUsers,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.tsx';
import * as api from '../api/endpoints.ts';
import { EventSummary, HallData, Template } from '../types/types.ts';
import { navigate } from '../hooks/useHashRoute.ts';
import { defaultGroups } from '../utils/guests.ts';
import { formatDate } from '../utils/labels.ts';
import { readJSON, writeString, readString } from '../utils/storage.ts';
import { normalizeHall } from '../utils/validation.ts';
import EventFormModal, { EventFormValues } from '../components/EventFormModal';
import VenueSettingsModal from '../components/VenueSettingsModal';
import LanguageSwitch from '../components/LanguageSwitch';
import { Flourish, RingsWreath } from '../components/Illustrations';

/** Draft saved by the first version of the app (single hall, no accounts). */
const LEGACY_DRAFT_KEY = 'hall-draft';
const LEGACY_IMPORTED_KEY = 'legacy-imported';

function readLegacyHall(): HallData | null {
    if (readString(LEGACY_IMPORTED_KEY)) return null;
    const draft = readJSON(LEGACY_DRAFT_KEY, (value): value is { hall: unknown } => typeof value === 'object' && value !== null && 'hall' in value);
    const hall = draft ? normalizeHall(draft.hall) : null;
    return hall && hall.tables.length ? hall : null;
}

const today = () => new Date().toISOString().slice(0, 10);

function Dashboard() {
    const { t, i18n } = useTranslation();
    const { venue, user, logout, setVenue } = useAuth();
    const [events, setEvents] = useState<EventSummary[] | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [offline, setOffline] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [legacyHall, setLegacyHall] = useState(readLegacyHall);

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            const [eventList, templateList] = await Promise.all([api.listEvents(signal), api.listTemplates(signal)]);
            setEvents(eventList);
            setTemplates(templateList);
            setOffline(false);
        } catch (error) {
            if (signal?.aborted) return;
            console.error(error);
            setOffline(true);
            setEvents(current => current ?? []);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const createEvent = async ({ title, date, templateId }: EventFormValues) => {
        const template = templates.find(tpl => tpl.id === templateId);
        const hall: HallData = {
            tables: template?.hall.tables || [],
            elements: template?.hall.elements || [],
            bgGradients: template?.hall.bgGradients || { color1: '', color2: '' },
            guests: [],
            groups: defaultGroups(t),
        };
        try {
            const event = await api.createEvent({ title, date, hall });
            navigate(`/event/${event.id}`);
        } catch {
            notifications.show({ color: 'red', message: t('save_failed') });
            throw new Error('create failed');
        }
    };

    const importLegacy = async () => {
        if (!legacyHall) return;
        try {
            const hall = { ...legacyHall, groups: legacyHall.groups.length ? legacyHall.groups : defaultGroups(t) };
            const event = await api.createEvent({ title: t('legacy_event_title'), date: '', hall });
            writeString(LEGACY_IMPORTED_KEY, new Date().toISOString());
            setLegacyHall(null);
            navigate(`/event/${event.id}`);
        } catch {
            notifications.show({ color: 'red', message: t('save_failed') });
        }
    };

    const confirmDelete = (event: EventSummary) =>
        modals.openConfirmModal({
            title: <Text className="modal-title">{t('delete_event_title')}</Text>,
            children: <Text size="sm" c="dimmed">{t('delete_event_text', { title: event.title })}</Text>,
            labels: { confirm: t('btn_delete'), cancel: t('btn_cancel') },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                await api.deleteEvent(event.id).catch(() => notifications.show({ color: 'red', message: t('save_failed') }));
                load();
            },
        });

    const deleteTemplate = (template: Template) =>
        modals.openConfirmModal({
            title: <Text className="modal-title">{t('delete_template_title')}</Text>,
            children: <Text size="sm" c="dimmed">{template.name}</Text>,
            labels: { confirm: t('btn_delete'), cancel: t('btn_cancel') },
            confirmProps: { color: 'red' },
            onConfirm: async () => {
                await api.deleteTemplate(template.id).catch(() => undefined);
                load();
            },
        });

    const upcoming = (events || []).filter(event => !event.date || event.date >= today());
    const past = (events || []).filter(event => event.date && event.date < today());

    const renderEvent = (event: EventSummary) => {
        const percent = event.stats.guests ? Math.round((event.stats.seated / event.stats.guests) * 100) : 0;
        const isPast = !!event.date && event.date < today();
        return (
            <Card key={event.id} className={`event-card ${isPast ? 'past' : ''}`} radius="lg" padding="lg" onClick={() => navigate(`/event/${event.id}`)}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4}>
                        <Text className="event-card-title">{event.title}</Text>
                        <Group gap={6} c="dimmed">
                            <IconCalendarEvent size={14} />
                            <Text size="sm">{event.date ? formatDate(event.date, i18n.language) : t('no_date')}</Text>
                        </Group>
                    </Stack>
                    <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" onClick={e => e.stopPropagation()} aria-label={t('more')}>
                                <IconDots size={16} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown onClick={e => e.stopPropagation()}>
                            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => confirmDelete(event)}>
                                {t('btn_delete')}
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
                <Group gap="xs" mt="md">
                    <Badge variant="light" color="gold">{t('n_tables', { count: event.stats.tables })}</Badge>
                    <Badge variant="light" color="blush" leftSection={<IconUsers size={12} />}>
                        {event.stats.seated}/{event.stats.guests}
                    </Badge>
                </Group>
                <Progress value={percent} color="sage" size="sm" radius="xl" mt="sm" />
                <Text size="xs" c="dimmed" mt={4}>{t('seated_percent', { percent })}</Text>
            </Card>
        );
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <Group gap="sm" wrap="nowrap">
                    {venue?.logo ? <Image src={venue.logo} h={40} w="auto" fit="contain" alt="" /> : <RingsWreath size={44} />}
                    <Stack gap={0}>
                        <Text className="dashboard-venue">{venue?.name}</Text>
                        <Text size="xs" c="dimmed">{user?.email}</Text>
                    </Stack>
                </Group>
                <Group gap="xs" wrap="nowrap">
                    <LanguageSwitch className="dashboard-lang" />
                    <Button variant="subtle" color="gold.2" leftSection={<IconSettings size={16} />} onClick={() => setIsSettingsOpen(true)} visibleFrom="sm">
                        {t('venue_settings')}
                    </Button>
                    <ActionIcon variant="subtle" color="gold.2" size="lg" onClick={() => setIsSettingsOpen(true)} hiddenFrom="sm" aria-label={t('venue_settings')}>
                        <IconSettings size={18} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="gold.2" size="lg" onClick={logout} aria-label={t('logout')} title={t('logout')}>
                        <IconLogout size={18} />
                    </ActionIcon>
                </Group>
            </header>

            <Container size="lg" py="xl">
                <Stack gap="xl">
                    <Group justify="space-between" align="flex-end">
                        <Stack gap={2}>
                            <Title className="dashboard-title">{t('your_events')}</Title>
                            <Flourish width={150} />
                        </Stack>
                        <Button
                            size="md"
                            leftSection={<IconPlus size={18} />}
                            variant="gradient"
                            gradient={{ from: 'gold.4', to: 'gold.7', deg: 135 }}
                            onClick={() => setIsCreateOpen(true)}
                            disabled={offline}
                        >
                            {t('new_event')}
                        </Button>
                    </Group>

                    {offline && (
                        <Alert color="red" variant="light" icon={<IconCloudOff size={18} />}>
                            {t('server_off')}
                        </Alert>
                    )}

                    {legacyHall && !offline && events?.length === 0 && (
                        <Alert color="gold" variant="light" icon={<IconHistory size={18} />} title={t('legacy_title')}>
                            <Stack gap="xs" align="flex-start">
                                <Text size="sm">{t('legacy_text', { tables: legacyHall.tables.length, guests: legacyHall.guests.length })}</Text>
                                <Button size="xs" onClick={importLegacy}>{t('legacy_import')}</Button>
                            </Stack>
                        </Alert>
                    )}

                    {events === null ? (
                        <Group justify="center" py="xl">
                            <Loader color="gold" type="dots" />
                        </Group>
                    ) : events.length === 0 && !offline ? (
                        <Card className="event-empty" radius="xl" padding="xl">
                            <Stack align="center" gap="xs" ta="center">
                                <RingsWreath size={110} />
                                <Text className="hall-empty-title">{t('no_events_title')}</Text>
                                <Text size="sm" c="dimmed" maw={380}>{t('no_events_text')}</Text>
                                <Button mt="sm" leftSection={<IconPlus size={16} />} onClick={() => setIsCreateOpen(true)}>
                                    {t('new_event')}
                                </Button>
                            </Stack>
                        </Card>
                    ) : (
                        <>
                            {upcoming.length > 0 && (
                                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                    {upcoming.map(renderEvent)}
                                </SimpleGrid>
                            )}
                            {past.length > 0 && (
                                <Stack gap="sm">
                                    <Text fw={700} c="dimmed" tt="uppercase" size="xs" style={{ letterSpacing: 1.2 }}>
                                        {t('past_events')}
                                    </Text>
                                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                        {past.map(renderEvent)}
                                    </SimpleGrid>
                                </Stack>
                            )}
                        </>
                    )}

                    <Stack gap="sm">
                        <Group gap={8}>
                            <IconTemplate size={18} color="var(--gold)" />
                            <Text fw={700} size="lg" className="dashboard-section">{t('templates_title')}</Text>
                        </Group>
                        <Text size="sm" c="dimmed">{t('templates_hint')}</Text>
                        {templates.length > 0 && (
                            <Group gap="xs">
                                {templates.map(template => (
                                    <Badge
                                        key={template.id}
                                        size="xl"
                                        radius="md"
                                        variant="light"
                                        color="gold"
                                        className="template-badge"
                                        rightSection={
                                            <ActionIcon size="xs" variant="transparent" color="red" onClick={() => deleteTemplate(template)} aria-label={t('btn_delete')}>
                                                <IconTrash size={12} />
                                            </ActionIcon>
                                        }
                                    >
                                        {template.name} · {t('n_tables', { count: template.hall.tables.length })}
                                    </Badge>
                                ))}
                            </Group>
                        )}
                    </Stack>
                </Stack>
            </Container>

            <EventFormModal opened={isCreateOpen} onClose={() => setIsCreateOpen(false)} templates={templates} onSubmit={createEvent} />
            {venue && (
                <VenueSettingsModal opened={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} venue={venue} onSaved={setVenue} />
            )}
        </div>
    );
}

export default Dashboard;
