import { EventRecord, EventSummary, HallData, Template, User, Venue } from '../types/types.ts';
import { normalizeHall } from '../utils/validation.ts';
import { ApiError, LOCAL_MODE, request } from './client.ts';
import * as local from './local.ts';

export interface Session {
    token: string;
    user: User;
    venue: Venue;
}

// In local mode (no backend) the functions below use localStorage instead — see local.ts.

// ---- Auth & venue ------------------------------------------------------------------

export const register = (venueName: string, email: string, password: string) =>
    request<Session>('/api/auth/register', { method: 'POST', json: { venueName, email, password } });

export const login = (email: string, password: string) =>
    request<Session>('/api/auth/login', { method: 'POST', json: { email, password } });

export const logout = () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }).catch(() => undefined);

export const fetchMe = (signal?: AbortSignal) => request<{ user: User; venue: Venue }>('/api/me', { signal });

export const updateVenue = (patch: Partial<Omit<Venue, 'id'>>) =>
    LOCAL_MODE ? local.updateVenue(patch) : request<Venue>('/api/venue', { method: 'PUT', json: patch });

// ---- Events --------------------------------------------------------------------------

function normalizeEvent(raw: EventRecord): EventRecord {
    const hall = normalizeHall(raw?.hall);
    if (!hall) throw new ApiError('invalid-data');
    return { ...raw, hall };
}

export const listEvents = (signal?: AbortSignal) =>
    LOCAL_MODE ? local.listEvents() : request<EventSummary[]>('/api/events', { signal });

export const createEvent = (input: { title: string; date: string; hall?: HallData }) =>
    LOCAL_MODE
        ? local.createEvent(input)
        : request<EventRecord>('/api/events', { method: 'POST', json: input }).then(normalizeEvent);

export const fetchEvent = (id: string, signal?: AbortSignal) =>
    LOCAL_MODE
        ? local.fetchEvent(id)
        : request<EventRecord>(`/api/events/${encodeURIComponent(id)}`, { signal }).then(normalizeEvent);

export const saveEvent = (id: string, input: { hall?: HallData; title?: string; date?: string; version?: number; force?: boolean }) =>
    LOCAL_MODE
        ? local.saveEvent(id, input)
        : request<{ version: number; updatedAt: string }>(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', json: input });

export const deleteEvent = (id: string) =>
    LOCAL_MODE
        ? local.deleteEvent(id)
        : request<{ success: boolean }>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const rotateShareLink = (id: string) =>
    request<{ shareToken: string }>(`/api/events/${encodeURIComponent(id)}/share/rotate`, { method: 'POST' });

// ---- Templates -----------------------------------------------------------------------

export const listTemplates = (signal?: AbortSignal) =>
    LOCAL_MODE ? local.listTemplates() : request<Template[]>('/api/templates', { signal });

export const createTemplate = (name: string, hall: Template['hall']) =>
    LOCAL_MODE ? local.createTemplate(name, hall) : request<Template>('/api/templates', { method: 'POST', json: { name, hall } });

export const deleteTemplate = (id: string) =>
    LOCAL_MODE
        ? local.deleteTemplate(id)
        : request<{ success: boolean }>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ---- Couple share link (no login, needs the backend) ----------------------------------

export interface SharedEvent {
    title: string;
    date: string;
    hall: HallData;
    version: number;
    venue: Venue;
}

export const fetchShared = (token: string, signal?: AbortSignal) =>
    request<SharedEvent>(`/api/share/${encodeURIComponent(token)}`, { signal }).then(raw => {
        const hall = normalizeHall(raw?.hall);
        if (!hall) throw new ApiError('invalid-data');
        return { ...raw, hall };
    });

export const saveShared = (token: string, hall: HallData, version: number, force = false) =>
    request<{ version: number; updatedAt: string }>(`/api/share/${encodeURIComponent(token)}`, {
        method: 'PUT',
        json: { hall, version, force },
    });

// ---- Public "find your table" page (QR, needs the backend) ----------------------------

export interface LookupInfo {
    title: string;
    date: string;
    venue: Venue;
    plan: Pick<HallData, 'tables' | 'elements' | 'bgGradients'>;
}

export interface LookupMatch {
    name: string;
    tableId: number;
}

export const fetchLookup = (token: string, signal?: AbortSignal) =>
    request<LookupInfo>(`/api/lookup/${encodeURIComponent(token)}`, { signal }).then(raw => {
        const hall = normalizeHall({ ...raw?.plan, guests: [], groups: [] });
        if (!hall) throw new ApiError('invalid-data');
        return { ...raw, plan: hall };
    });

export const searchLookup = (token: string, query: string, signal?: AbortSignal) =>
    request<LookupMatch[]>(`/api/lookup/${encodeURIComponent(token)}/search?q=${encodeURIComponent(query)}`, { signal });
