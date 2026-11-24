import { useState } from 'react';
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconBuildingCastle, IconLock, IconMail } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.tsx';
import { errorCode } from '../api/client.ts';
import { navigate } from '../hooks/useHashRoute.ts';
import { Flourish, RingsWreath } from '../components/Illustrations';
import LanguageSwitch from '../components/LanguageSwitch';

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
    const { t } = useTranslation();
    const auth = useAuth();
    const [venueName, setVenueName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const isRegister = mode === 'register';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isRegister) await auth.register(venueName, email, password);
            else await auth.login(email, password);
            if (/^#\/(login|register)/.test(window.location.hash)) navigate('/');
        } catch (err) {
            setError(`auth_error_${errorCode(err).replace(/[^a-z-]/g, '')}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-lang">
                <LanguageSwitch />
            </div>
            <Paper className="auth-card" radius="xl" p="xl">
                <form onSubmit={submit}>
                    <Stack gap="md">
                        <Stack gap={4} align="center" ta="center">
                            <RingsWreath size={96} />
                            <Text className="auth-title">{t('app_name')}</Text>
                            <Text size="sm" c="dimmed">{t(isRegister ? 'register_subtitle' : 'login_subtitle')}</Text>
                            <Flourish width={160} />
                        </Stack>

                        {error && (
                            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} p="xs">
                                <Text size="sm">{t(error, { defaultValue: t('auth_error_unknown') })}</Text>
                            </Alert>
                        )}

                        {isRegister && (
                            <TextInput
                                required
                                label={t('venue_name')}
                                placeholder={t('venue_name_placeholder')}
                                leftSection={<IconBuildingCastle size={16} />}
                                value={venueName}
                                onChange={e => setVenueName(e.currentTarget.value)}
                                autoComplete="organization"
                            />
                        )}
                        <TextInput
                            required
                            type="email"
                            label={t('email')}
                            placeholder="name@example.com"
                            leftSection={<IconMail size={16} />}
                            value={email}
                            onChange={e => setEmail(e.currentTarget.value)}
                            autoComplete="email"
                        />
                        <PasswordInput
                            required
                            label={t('password')}
                            description={isRegister ? t('password_hint') : undefined}
                            leftSection={<IconLock size={16} />}
                            value={password}
                            onChange={e => setPassword(e.currentTarget.value)}
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                            minLength={isRegister ? 6 : undefined}
                        />
                        <Button type="submit" size="md" loading={loading} variant="gradient" gradient={{ from: 'gold.4', to: 'gold.7', deg: 135 }}>
                            {t(isRegister ? 'btn_register' : 'btn_login')}
                        </Button>
                        <Text size="sm" ta="center" c="dimmed">
                            {t(isRegister ? 'have_account' : 'no_account')}{' '}
                            <Anchor href={isRegister ? '#/login' : '#/register'} c="blush.7" fw={600}>
                                {t(isRegister ? 'btn_login' : 'btn_register')}
                            </Anchor>
                        </Text>
                    </Stack>
                </form>
            </Paper>
        </div>
    );
}

export default AuthPage;
