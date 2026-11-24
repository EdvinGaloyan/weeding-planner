import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './index.css';
import './i18n.ts';
import { theme } from './theme.ts';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MantineProvider theme={theme} defaultColorScheme="light">
            <ModalsProvider>
                <Notifications position="top-right" />
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ModalsProvider>
        </MantineProvider>
    </React.StrictMode>,
);
