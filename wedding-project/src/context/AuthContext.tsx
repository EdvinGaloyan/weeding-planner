import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, getToken, onUnauthorized, setToken } from '../api/client.ts';
import * as api from '../api/endpoints.ts';
import { User, Venue } from '../types/types.ts';
import { readJSON, removeKey, writeJSON } from '../utils/storage.ts';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface CachedSession {
    user: User;
    venue: Venue;
}

interface AuthContextValue {
    status: AuthStatus;
    user: User | null;
    venue: Venue | null;
    login: (email: string, password: string) => Promise<void>;
    register: (venueName: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setVenue: (venue: Venue) => void;
}

const SESSION_KEY = 'session';
const isCachedSession = (value: unknown): value is CachedSession =>
    typeof value === 'object' && value !== null && 'user' in value && 'venue' in value;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    // The last known session lets the planner open even when the server is unreachable
    const [session, setSession] = useState<CachedSession | null>(() =>
        getToken() ? readJSON(SESSION_KEY, isCachedSession) : null,
    );
    const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'anonymous'));

    const remember = useCallback((next: CachedSession | null) => {
        setSession(next);
        if (next) writeJSON(SESSION_KEY, next);
        else removeKey(SESSION_KEY);
    }, []);

    const signOutLocally = useCallback(() => {
        setToken(null);
        remember(null);
        setStatus('anonymous');
    }, [remember]);

    useEffect(() => onUnauthorized(signOutLocally), [signOutLocally]);

    useEffect(() => {
        if (!getToken()) return;
        const controller = new AbortController();
        api.fetchMe(controller.signal)
            .then(me => {
                remember(me);
                setStatus('authenticated');
            })
            .catch(error => {
                if (controller.signal.aborted) return;
                // Offline: keep working with the cached session
                if (error instanceof ApiError && error.message === 'offline' && readJSON(SESSION_KEY, isCachedSession)) {
                    setStatus('authenticated');
                } else signOutLocally();
            });
        return () => controller.abort();
    }, [remember, signOutLocally]);

    const value = useMemo<AuthContextValue>(
        () => ({
            status,
            user: session?.user ?? null,
            venue: session?.venue ?? null,
            login: async (email, password) => {
                const result = await api.login(email, password);
                setToken(result.token);
                remember({ user: result.user, venue: result.venue });
                setStatus('authenticated');
            },
            register: async (venueName, email, password) => {
                const result = await api.register(venueName, email, password);
                setToken(result.token);
                remember({ user: result.user, venue: result.venue });
                setStatus('authenticated');
            },
            logout: async () => {
                await api.logout();
                signOutLocally();
            },
            setVenue: venue => session && remember({ ...session, venue }),
        }),
        [remember, session, signOutLocally, status],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
    return context;
}
