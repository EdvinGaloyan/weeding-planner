import { useEffect } from 'react';
import { Loader } from '@mantine/core';
import './App.scss';
import { useAuth } from './context/AuthContext.tsx';
import { navigate, useHashRoute } from './hooks/useHashRoute.ts';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import EventPage from './pages/EventPage';
import SharePage from './pages/SharePage';
import LookupPage from './pages/LookupPage';
import { NotFound } from './pages/EventPage';
import { LOCAL_MODE } from './api/client.ts';

function App() {
    const route = useHashRoute();
    const auth = useAuth();

    // Signed-in users don't need the login screen
    useEffect(() => {
        if (auth.status === 'authenticated' && (route.name === 'login' || route.name === 'register')) navigate('/');
    }, [auth.status, route.name]);

    // Public pages: no account needed
    // Couple link & QR page need the backend; in local mode the data never leaves this browser
    if ((route.name === 'share' || route.name === 'find') && LOCAL_MODE) return <NotFound />;
    if (route.name === 'share') return <SharePage key={route.token} token={route.token} />;
    if (route.name === 'find') return <LookupPage key={route.token} token={route.token} />;

    if (auth.status === 'loading') {
        return (
            <div className="auth-page">
                <Loader color="gold" type="dots" />
            </div>
        );
    }

    if (auth.status === 'anonymous') return <AuthPage mode={route.name === 'register' ? 'register' : 'login'} />;

    if (route.name === 'event') return <EventPage key={route.id} id={route.id} />;
    return <Dashboard />;
}

export default App;
