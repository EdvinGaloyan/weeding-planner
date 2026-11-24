import { useEffect, useState } from 'react';

export type Route =
    | { name: 'login' }
    | { name: 'register' }
    | { name: 'dashboard' }
    | { name: 'event'; id: string }
    | { name: 'share'; token: string }
    | { name: 'find'; token: string };

/** Hash routes keep the app a static bundle: #/, #/event/:id, #/share/:token, #/find/:token … */
export function parseRoute(hash: string): Route {
    const [, first = '', second = ''] = hash.replace(/^#/, '').split('/');
    const param = decodeURIComponent(second);
    switch (first) {
        case 'login':
            return { name: 'login' };
        case 'register':
            return { name: 'register' };
        case 'event':
            return param ? { name: 'event', id: param } : { name: 'dashboard' };
        case 'share':
            return param ? { name: 'share', token: param } : { name: 'dashboard' };
        case 'find':
            return param ? { name: 'find', token: param } : { name: 'dashboard' };
        default:
            return { name: 'dashboard' };
    }
}

export const navigate = (path: string) => {
    window.location.hash = path;
};

/** Absolute link to a route, for sharing (couple link, QR code). */
export const routeUrl = (path: string) => `${window.location.origin}${window.location.pathname}#${path}`;

export function useHashRoute(): Route {
    const [route, setRoute] = useState(() => parseRoute(window.location.hash));
    useEffect(() => {
        const update = () => {
            setRoute(parseRoute(window.location.hash));
            window.scrollTo(0, 0);
        };
        window.addEventListener('hashchange', update);
        return () => window.removeEventListener('hashchange', update);
    }, []);
    return route;
}
