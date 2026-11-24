import { readString, removeKey, writeString } from '../utils/storage.ts';

// Override with VITE_API_URL in an .env file when the backend runs elsewhere
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

const TOKEN_KEY = 'auth-token';

/** offline | unauthorized | conflict | not-found | invalid | HTTP <status> */
export class ApiError extends Error {
    constructor(message: string, readonly status = 0, readonly body?: unknown) {
        super(message);
    }
}

let token: string | null = readString(TOKEN_KEY) || null;
const unauthorizedListeners = new Set<() => void>();

export const getToken = () => token;

export function setToken(value: string | null) {
    token = value;
    if (value) writeString(TOKEN_KEY, value);
    else removeKey(TOKEN_KEY);
}

/** Called when the server says the session is no longer valid. */
export function onUnauthorized(listener: () => void) {
    unauthorizedListeners.add(listener);
    return () => {
        unauthorizedListeners.delete(listener);
    };
}

export async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, headers, ...rest } = init;
    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            ...rest,
            headers: {
                ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: json !== undefined ? JSON.stringify(json) : rest.body,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        // Network failure: server down, CORS, offline...
        throw new ApiError('offline');
    }

    const body = await response.json().catch(() => undefined);
    if (response.ok) return body as T;

    if (response.status === 401) {
        unauthorizedListeners.forEach(listener => listener());
        throw new ApiError('unauthorized', 401, body);
    }
    if (response.status === 409) throw new ApiError('conflict', 409, body);
    if (response.status === 404) throw new ApiError('not-found', 404, body);
    if (response.status === 400) throw new ApiError('invalid', 400, body);
    throw new ApiError(`HTTP ${response.status}`, response.status, body);
}

export const errorCode = (error: unknown) =>
    error instanceof ApiError && error.body && typeof error.body === 'object' && 'code' in error.body
        ? String((error.body as { code: unknown }).code)
        : error instanceof ApiError
          ? error.message
          : 'unknown';
