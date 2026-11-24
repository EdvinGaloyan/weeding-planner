import * as api from '../api/endpoints.ts';
import { EventRecord, Template, Venue } from '../types/types.ts';
import { normalizeHall } from './validation.ts';

/** Everything of a venue in one JSON file: to keep a copy, or to move between browsers / servers. */
export interface Backup {
    app: 'wedding-planner';
    version: 1;
    exportedAt: string;
    venue: Pick<Venue, 'name' | 'logo' | 'brandColor'>;
    events: Pick<EventRecord, 'title' | 'date' | 'hall'>[];
    templates: Pick<Template, 'name' | 'hall'>[];
}

export async function exportBackup(venue: Venue | null): Promise<Backup> {
    const summaries = await api.listEvents();
    const events = await Promise.all(summaries.map(summary => api.fetchEvent(summary.id)));
    const templates = await api.listTemplates();
    return {
        app: 'wedding-planner',
        version: 1,
        exportedAt: new Date().toISOString(),
        venue: { name: venue?.name || '', logo: venue?.logo, brandColor: venue?.brandColor },
        events: events.map(({ title, date, hall }) => ({ title, date, hall })),
        templates: templates.map(({ name, hall }) => ({ name, hall })),
    };
}

export function downloadJson(data: unknown, fileName: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

export function parseBackup(text: string): Backup {
    const data = JSON.parse(text) as Partial<Backup>;
    if (data?.app !== 'wedding-planner' || data.version !== 1 || !Array.isArray(data.events)) throw new Error('invalid backup');
    return data as Backup;
}

/** Adds the backup's weddings and templates next to the existing ones (nothing is overwritten). */
export async function importBackup(backup: Backup): Promise<{ events: number; templates: number }> {
    let events = 0;
    for (const event of backup.events) {
        const hall = normalizeHall(event.hall);
        if (!hall || typeof event.title !== 'string') continue;
        await api.createEvent({ title: event.title, date: typeof event.date === 'string' ? event.date : '', hall });
        events++;
    }
    let templates = 0;
    for (const template of backup.templates || []) {
        const hall = normalizeHall({ ...template.hall, guests: [], groups: [] });
        if (!hall || typeof template.name !== 'string') continue;
        await api.createTemplate(template.name, { tables: hall.tables, elements: hall.elements, bgGradients: hall.bgGradients });
        templates++;
    }
    return { events, templates };
}
