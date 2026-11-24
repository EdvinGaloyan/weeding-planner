/**
 * "Local mode": the whole API implemented on top of localStorage, so the app runs as a
 * static site (e.g. on Vercel) without a backend. Everything stays in this browser.
 * Same function signatures as the server API in endpoints.ts.
 */
import { EventRecord, EventSummary, HallData, Template, Venue } from '../types/types.ts';
import { readJSON, writeJSON } from '../utils/storage.ts';
import { normalizeHall } from '../utils/validation.ts';
import { newId } from '../utils/guests.ts';
import { ApiError } from './client.ts';

interface LocalDb {
    version: 1;
    venue: Venue;
    events: EventRecord[];
    templates: Template[];
}

const DB_KEY = 'local-db';

const isDb = (value: unknown): value is LocalDb =>
    typeof value === 'object' && value !== null && (value as LocalDb).version === 1 && Array.isArray((value as LocalDb).events);

function load(): LocalDb {
    return readJSON(DB_KEY, isDb) ?? { version: 1, venue: { id: 'local', name: '' }, events: [], templates: [] };
}

function save(db: LocalDb) {
    // localStorage is ~5 MB per site — a failed write must not look like a successful save
    if (!writeJSON(DB_KEY, db)) throw new ApiError('save-failed');
}

const now = () => new Date().toISOString();
const notFound = () => new ApiError('not-found', 404);

function withHall(event: EventRecord): EventRecord {
    return { ...event, hall: normalizeHall(event.hall) ?? event.hall };
}

// ---- Venue ---------------------------------------------------------------------------

export const getVenue = (): Venue => load().venue;

export async function updateVenue(patch: Partial<Omit<Venue, 'id'>>): Promise<Venue> {
    const db = load();
    db.venue = {
        ...db.venue,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.logo !== undefined ? { logo: patch.logo || undefined } : {}),
        ...(patch.brandColor !== undefined ? { brandColor: patch.brandColor || undefined } : {}),
    };
    save(db);
    return db.venue;
}

// ---- Events --------------------------------------------------------------------------

export async function listEvents(): Promise<EventSummary[]> {
    return load()
        .events.map(event => ({
            id: event.id,
            title: event.title,
            date: event.date,
            updatedAt: event.updatedAt,
            stats: {
                tables: event.hall.tables.length,
                seats: event.hall.tables.reduce((sum, t) => sum + t.capacity, 0),
                guests: event.hall.guests.length,
                seated: event.hall.guests.filter(g => g.tableId !== undefined && g.seat !== undefined).length,
            },
        }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt.localeCompare(a.updatedAt));
}

export async function createEvent(input: { title: string; date: string; hall?: HallData }): Promise<EventRecord> {
    const db = load();
    const event: EventRecord = {
        id: newId(),
        title: input.title.trim(),
        date: input.date,
        hall: normalizeHall(input.hall ?? { tables: [] })!,
        version: 1,
        shareToken: '',
        lookupToken: '',
        updatedAt: now(),
    };
    db.events.push(event);
    save(db);
    return event;
}

export async function fetchEvent(id: string): Promise<EventRecord> {
    const event = load().events.find(e => e.id === id);
    if (!event) throw notFound();
    return withHall(event);
}

export async function saveEvent(
    id: string,
    input: { hall?: HallData; title?: string; date?: string },
): Promise<{ version: number; updatedAt: string }> {
    const db = load();
    const event = db.events.find(e => e.id === id);
    if (!event) throw notFound();
    if (input.hall) {
        event.hall = input.hall;
        event.version++;
    }
    if (input.title !== undefined) event.title = input.title.trim();
    if (input.date !== undefined) event.date = input.date;
    event.updatedAt = now();
    save(db);
    return { version: event.version, updatedAt: event.updatedAt };
}

export async function deleteEvent(id: string): Promise<{ success: boolean }> {
    const db = load();
    db.events = db.events.filter(e => e.id !== id);
    save(db);
    return { success: true };
}

// ---- Templates -----------------------------------------------------------------------

export async function listTemplates(): Promise<Template[]> {
    return load().templates;
}

export async function createTemplate(name: string, hall: Template['hall']): Promise<Template> {
    const db = load();
    const template: Template = { id: newId(), name: name.trim(), hall, createdAt: now() };
    db.templates.push(template);
    save(db);
    return template;
}

export async function deleteTemplate(id: string): Promise<{ success: boolean }> {
    const db = load();
    db.templates = db.templates.filter(t => t.id !== id);
    save(db);
    return { success: true };
}
