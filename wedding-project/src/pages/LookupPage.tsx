import { useEffect, useState } from 'react';
import { Image, Loader, Paper, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconArmchair, IconSearch } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import * as api from '../api/endpoints.ts';
import { formatDate, tableLabel } from '../utils/labels.ts';
import HallPlanSvg from '../components/HallPlanSvg';
import LanguageSwitch from '../components/LanguageSwitch';
import { Flourish, RingsWreath } from '../components/Illustrations';
import { NotFound } from './EventPage';

/** Public page behind the QR code at the entrance: type your name, see your table. */
function LookupPage({ token }: { token: string }) {
    const { t, i18n } = useTranslation();
    const [info, setInfo] = useState<api.LookupInfo | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'offline'>('loading');
    const [query, setQuery] = useState('');
    const [matches, setMatches] = useState<api.LookupMatch[]>([]);
    const [searching, setSearching] = useState(false);
    const [selected, setSelected] = useState<api.LookupMatch | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        api.fetchLookup(token, controller.signal)
            .then(data => {
                setInfo(data);
                setStatus('ready');
            })
            .catch(error => {
                if (controller.signal.aborted) return;
                setStatus(error instanceof Error && error.message === 'not-found' ? 'not-found' : 'offline');
            });
        return () => controller.abort();
    }, [token]);

    // Search as the guest types (debounced)
    useEffect(() => {
        const q = query.trim();
        setSelected(null);
        if (q.length < 2) {
            setMatches([]);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setSearching(true);
            api.searchLookup(token, q, controller.signal)
                .then(result => {
                    setMatches(result);
                    if (result.length === 1) setSelected(result[0]);
                })
                .catch(() => undefined)
                .finally(() => setSearching(false));
        }, 250);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, token]);

    if (status === 'not-found') return <NotFound />;

    const brand = info?.venue.brandColor;
    const table = selected && info ? info.plan.tables.find(tbl => tbl.id === selected.tableId) : undefined;

    return (
        <div className="lookup-page" style={brand ? ({ '--brand': brand } as React.CSSProperties) : undefined}>
            <div className="auth-lang">
                <LanguageSwitch />
            </div>
            <Stack gap="lg" align="center" className="lookup-inner">
                <Stack gap={4} align="center" ta="center">
                    {info?.venue.logo ? <Image src={info.venue.logo} h={70} w="auto" fit="contain" alt="" /> : <RingsWreath size={90} />}
                    {info?.venue.name && (
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: 2 }}>
                            {info.venue.name}
                        </Text>
                    )}
                    <Text className="lookup-title">{info?.title || t('lookup_title')}</Text>
                    {info?.date && <Text size="sm" c="dimmed">{formatDate(info.date, i18n.language)}</Text>}
                    <Flourish width={170} />
                </Stack>

                {status === 'loading' && <Loader color="gold" type="dots" />}
                {status === 'offline' && <Text c="red">{t('server_off')}</Text>}

                {status === 'ready' && info && (
                    <Paper className="lookup-card" radius="xl" p="lg" w="100%">
                        <Stack gap="md">
                            <Text fw={700} ta="center" size="lg">{t('lookup_question')}</Text>
                            <TextInput
                                size="lg"
                                radius="xl"
                                autoFocus
                                leftSection={<IconSearch size={18} />}
                                rightSection={searching ? <Loader size="xs" color="gold" /> : undefined}
                                placeholder={t('lookup_placeholder')}
                                value={query}
                                onChange={e => setQuery(e.currentTarget.value)}
                            />

                            {!selected && matches.length > 1 && (
                                <Stack gap={6}>
                                    {matches.map((match, i) => (
                                        <UnstyledButton key={i} className="lookup-match" onClick={() => setSelected(match)}>
                                            <Text fw={600}>{match.name}</Text>
                                        </UnstyledButton>
                                    ))}
                                </Stack>
                            )}
                            {query.trim().length >= 2 && !searching && matches.length === 0 && (
                                <Text ta="center" c="dimmed" size="sm">{t('lookup_none')}</Text>
                            )}

                            {selected && table && (
                                <Stack gap="sm" align="center" className="lookup-result">
                                    <Text size="sm" c="dimmed">{selected.name}</Text>
                                    <Stack gap={0} align="center">
                                        <IconArmchair size={28} color="var(--brand, var(--gold))" />
                                        <Text className="lookup-table">{tableLabel(t, info.plan.tables, table)}</Text>
                                    </Stack>
                                    <HallPlanSvg hall={info.plan} highlightTableId={table.id} showNames={false} className="lookup-plan" />
                                </Stack>
                            )}
                        </Stack>
                    </Paper>
                )}
                <Text size="xs" c="dimmed">{t('lookup_footer')}</Text>
            </Stack>
        </div>
    );
}

export default LookupPage;
