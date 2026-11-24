/**
 * Wedding seating planner — backend.
 *
 * Venues (wedding halls / planners) register, then manage many events (weddings),
 * reusable hall templates and their branding. Each event can be shared with the
 * couple through a secret link, and has a public "find your table" page for the QR code.
 *
 * Storage is a single JSON file written atomically — fine for a handful of venues.
 * Move to a real database (PostgreSQL / SQLite) before onboarding many customers.
 */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
// Set LEGACY_FILE= (empty) to skip importing the hall of the first app version
const LEGACY_FILE = process.env.LEGACY_FILE ?? path.join(__dirname, 'hall_data.json');
const SESSION_DAYS = 30;

// Behind Railway/Render's proxy: use the real client IP (rate limiting) and https info
app.set('trust proxy', 1);
// In production the frontend is served by this same server, so CORS is only needed for local dev.
// CORS_ORIGIN can list extra allowed origins (comma separated).
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));
app.use(express.json({ limit: '3mb' })); // big weddings + a logo exceed the 100kb default

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Tiny JSON database
// ---------------------------------------------------------------------------

let db = { users: [], venues: [], sessions: [], events: [], templates: [] };
let writeQueue = Promise.resolve();

async function loadDb() {
    try {
        const parsed = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
        db = { ...db, ...parsed };
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Could not read the database, refusing to start so nothing gets overwritten:', error.message);
            process.exit(1);
        }
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

/** Writes are serialised and go to a temp file first — a crash mid-write never corrupts the data. */
function persist() {
    writeQueue = writeQueue
        .then(async () => {
            const tmp = `${DB_FILE}.tmp`;
            await fs.writeFile(tmp, JSON.stringify(db, null, 1), 'utf8');
            await fs.rename(tmp, DB_FILE);
        })
        .catch(error => console.error('Could not write the database:', error));
    return writeQueue;
}

const id = () => crypto.randomUUID();
const token = () => crypto.randomBytes(24).toString('base64url');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v, max = 200) => typeof v === 'string' && v.length <= max;

function isHall(value) {
    return (
        isObject(value) &&
        Array.isArray(value.tables) &&
        value.tables.length <= 500 &&
        value.tables.every(t => isObject(t) && Number.isFinite(t.id) && Number.isFinite(t.capacity)) &&
        (value.elements === undefined || (Array.isArray(value.elements) && value.elements.length <= 200)) &&
        (value.guests === undefined || (Array.isArray(value.guests) && value.guests.length <= 5000)) &&
        (value.groups === undefined || (Array.isArray(value.groups) && value.groups.length <= 100)) &&
        (value.bgGradients === undefined ||
            (isObject(value.bgGradients) && isStr(value.bgGradients.color1, 40) && isStr(value.bgGradients.color2, 40)))
    );
}

const cleanHall = hall => ({
    tables: hall.tables,
    elements: hall.elements || [],
    guests: hall.guests || [],
    groups: hall.groups || [],
    bgGradients: hall.bgGradients || { color1: '', color2: '' },
});

const layoutOnly = hall => ({
    tables: hall.tables,
    elements: hall.elements || [],
    bgGradients: hall.bgGradients || { color1: '', color2: '' },
});

const isDate = v => typeof v === 'string' && (v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v));
const isEmail = v => typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---------------------------------------------------------------------------
// Passwords & sessions
// ---------------------------------------------------------------------------

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

function verifyPassword(password, salt, expected) {
    const { hash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'));
}

function createSession(userId) {
    const raw = token();
    db.sessions = db.sessions.filter(s => new Date(s.expiresAt) > new Date());
    db.sessions.push({
        tokenHash: sha256(raw),
        userId,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
    });
    return raw;
}

function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7) : '';
    const session = raw && db.sessions.find(s => s.tokenHash === sha256(raw) && new Date(s.expiresAt) > new Date());
    const user = session && db.users.find(u => u.id === session.userId);
    if (!user) return res.status(401).json({ code: 'unauthorized' });
    req.user = user;
    req.venue = db.venues.find(v => v.id === user.venueId);
    req.tokenHash = session.tokenHash;
    next();
}

// Very small brute-force guard for login / register
const attempts = new Map();
function rateLimit(req, res, next) {
    const key = req.ip;
    const entry = attempts.get(key) || { count: 0, resetAt: Date.now() + 15 * 60e3 };
    if (Date.now() > entry.resetAt) Object.assign(entry, { count: 0, resetAt: Date.now() + 15 * 60e3 });
    entry.count++;
    attempts.set(key, entry);
    if (entry.count > 20) return res.status(429).json({ code: 'too-many-attempts' });
    next();
}

const publicUser = user => ({ id: user.id, email: user.email });
const publicVenue = venue => ({ id: venue.id, name: venue.name, logo: venue.logo, brandColor: venue.brandColor });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/register', rateLimit, async (req, res) => {
    const { venueName, email, password } = req.body || {};
    if (!isStr(venueName, 120) || !venueName.trim()) return res.status(400).json({ code: 'venue-required' });
    if (!isEmail(email)) return res.status(400).json({ code: 'invalid-email' });
    if (typeof password !== 'string' || password.length < 6 || password.length > 200)
        return res.status(400).json({ code: 'weak-password' });

    const normalizedEmail = email.trim().toLowerCase();
    if (db.users.some(u => u.email === normalizedEmail)) return res.status(409).json({ code: 'email-taken' });

    const venue = { id: id(), name: venueName.trim(), createdAt: now() };
    const { salt, hash } = hashPassword(password);
    const user = { id: id(), email: normalizedEmail, salt, passwordHash: hash, venueId: venue.id, createdAt: now() };
    db.venues.push(venue);
    db.users.push(user);
    await importLegacyHall(venue.id);
    const raw = createSession(user.id);
    await persist();
    res.json({ token: raw, user: publicUser(user), venue: publicVenue(venue) });
});

app.post('/api/auth/login', rateLimit, async (req, res) => {
    const { email, password } = req.body || {};
    const user = isEmail(email) && db.users.find(u => u.email === email.trim().toLowerCase());
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.salt, user.passwordHash)) {
        return res.status(400).json({ code: 'invalid-credentials' });
    }
    const raw = createSession(user.id);
    await persist();
    res.json({ token: raw, user: publicUser(user), venue: publicVenue(db.venues.find(v => v.id === user.venueId)) });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
    db.sessions = db.sessions.filter(s => s.tokenHash !== req.tokenHash);
    await persist();
    res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user), venue: publicVenue(req.venue) });
});

app.put('/api/venue', requireAuth, async (req, res) => {
    const { name, logo, brandColor } = req.body || {};
    if (name !== undefined) {
        if (!isStr(name, 120) || !name.trim()) return res.status(400).json({ code: 'venue-required' });
        req.venue.name = name.trim();
    }
    if (logo !== undefined) {
        if (logo !== '' && !(isStr(logo, 400_000) && /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(logo)))
            return res.status(400).json({ code: 'invalid-logo' });
        req.venue.logo = logo || undefined;
    }
    if (brandColor !== undefined) {
        if (brandColor !== '' && !(isStr(brandColor, 9) && /^#[0-9a-f]{6}$/i.test(brandColor)))
            return res.status(400).json({ code: 'invalid-color' });
        req.venue.brandColor = brandColor || undefined;
    }
    await persist();
    res.json(publicVenue(req.venue));
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function summary(event) {
    const { tables, guests } = event.hall;
    return {
        id: event.id,
        title: event.title,
        date: event.date,
        updatedAt: event.updatedAt,
        stats: {
            tables: tables.length,
            seats: tables.reduce((sum, t) => sum + (t.capacity || 0), 0),
            guests: guests.length,
            seated: guests.filter(g => g.tableId !== undefined && g.seat !== undefined).length,
        },
    };
}

const fullEvent = event => ({
    id: event.id,
    title: event.title,
    date: event.date,
    hall: event.hall,
    version: event.version,
    shareToken: event.shareToken,
    lookupToken: event.lookupToken,
    updatedAt: event.updatedAt,
});

function findOwnEvent(req, res) {
    const event = db.events.find(e => e.id === req.params.id && e.venueId === req.venue.id);
    if (!event) res.status(404).json({ code: 'not-found' });
    return event;
}

app.get('/api/events', requireAuth, (req, res) => {
    const events = db.events
        .filter(e => e.venueId === req.venue.id)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt.localeCompare(a.updatedAt));
    res.json(events.map(summary));
});

app.post('/api/events', requireAuth, async (req, res) => {
    const { title, date = '', hall } = req.body || {};
    if (!isStr(title, 120) || !title.trim()) return res.status(400).json({ code: 'title-required' });
    if (!isDate(date)) return res.status(400).json({ code: 'invalid-date' });
    if (hall !== undefined && !isHall(hall)) return res.status(400).json({ code: 'invalid-hall' });

    const event = {
        id: id(),
        venueId: req.venue.id,
        title: title.trim(),
        date,
        hall: cleanHall(hall || { tables: [] }),
        version: 1,
        shareToken: token(),
        lookupToken: token(),
        createdAt: now(),
        updatedAt: now(),
    };
    db.events.push(event);
    await persist();
    res.json(fullEvent(event));
});

app.get('/api/events/:id', requireAuth, (req, res) => {
    const event = findOwnEvent(req, res);
    if (event) res.json(fullEvent(event));
});

app.put('/api/events/:id', requireAuth, async (req, res) => {
    const event = findOwnEvent(req, res);
    if (!event) return;
    const { hall, title, date, version, force } = req.body || {};

    if (title !== undefined && (!isStr(title, 120) || !title.trim())) return res.status(400).json({ code: 'title-required' });
    if (date !== undefined && !isDate(date)) return res.status(400).json({ code: 'invalid-date' });
    if (hall !== undefined) {
        if (!isHall(hall)) return res.status(400).json({ code: 'invalid-hall' });
        // Someone else (the couple, another tab) saved in the meantime
        if (!force && version !== event.version) return res.status(409).json({ code: 'conflict', version: event.version });
        event.hall = cleanHall(hall);
        event.version++;
    }
    if (title !== undefined) event.title = title.trim();
    if (date !== undefined) event.date = date;
    event.updatedAt = now();
    await persist();
    res.json({ version: event.version, updatedAt: event.updatedAt });
});

app.delete('/api/events/:id', requireAuth, async (req, res) => {
    const event = findOwnEvent(req, res);
    if (!event) return;
    db.events = db.events.filter(e => e !== event);
    await persist();
    res.json({ success: true });
});

/** Issues a new couple link — the old one stops working. */
app.post('/api/events/:id/share/rotate', requireAuth, async (req, res) => {
    const event = findOwnEvent(req, res);
    if (!event) return;
    event.shareToken = token();
    await persist();
    res.json({ shareToken: event.shareToken });
});

// ---------------------------------------------------------------------------
// Templates (the venue's halls, reused for every wedding)
// ---------------------------------------------------------------------------

app.get('/api/templates', requireAuth, (req, res) => {
    res.json(db.templates.filter(t => t.venueId === req.venue.id).map(({ venueId: _v, ...t }) => t));
});

app.post('/api/templates', requireAuth, async (req, res) => {
    const { name, hall } = req.body || {};
    if (!isStr(name, 120) || !name.trim()) return res.status(400).json({ code: 'name-required' });
    if (!isHall(hall)) return res.status(400).json({ code: 'invalid-hall' });
    const template = { id: id(), venueId: req.venue.id, name: name.trim(), hall: layoutOnly(hall), createdAt: now() };
    db.templates.push(template);
    await persist();
    const { venueId: _v, ...rest } = template;
    res.json(rest);
});

app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    const before = db.templates.length;
    db.templates = db.templates.filter(t => !(t.id === req.params.id && t.venueId === req.venue.id));
    if (db.templates.length === before) return res.status(404).json({ code: 'not-found' });
    await persist();
    res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Couple link: the couple edits guests & seating, the layout stays read-only
// ---------------------------------------------------------------------------

const byShareToken = t => typeof t === 'string' && t.length > 10 && db.events.find(e => e.shareToken === t);

app.get('/api/share/:token', (req, res) => {
    const event = byShareToken(req.params.token);
    if (!event) return res.status(404).json({ code: 'not-found' });
    const venue = db.venues.find(v => v.id === event.venueId);
    res.json({ title: event.title, date: event.date, hall: event.hall, version: event.version, venue: publicVenue(venue) });
});

app.put('/api/share/:token', async (req, res) => {
    const event = byShareToken(req.params.token);
    if (!event) return res.status(404).json({ code: 'not-found' });
    const { hall, version, force } = req.body || {};
    if (!isHall(hall)) return res.status(400).json({ code: 'invalid-hall' });
    if (!force && version !== event.version) return res.status(409).json({ code: 'conflict', version: event.version });

    // Only guests, groups and table names come from the couple
    const names = new Map(hall.tables.map(t => [t.id, typeof t.tableName === 'string' ? t.tableName.slice(0, 80) : undefined]));
    event.hall = {
        ...event.hall,
        tables: event.hall.tables.map(t => ({ ...t, tableName: names.has(t.id) ? names.get(t.id) : t.tableName })),
        guests: hall.guests || [],
        groups: hall.groups || [],
    };
    event.version++;
    event.updatedAt = now();
    await persist();
    res.json({ version: event.version, updatedAt: event.updatedAt });
});

// ---------------------------------------------------------------------------
// Public "find your table" page behind the QR code
// ---------------------------------------------------------------------------

const byLookupToken = t => typeof t === 'string' && t.length > 10 && db.events.find(e => e.lookupToken === t);

app.get('/api/lookup/:token', (req, res) => {
    const event = byLookupToken(req.params.token);
    if (!event) return res.status(404).json({ code: 'not-found' });
    const venue = db.venues.find(v => v.id === event.venueId);
    res.json({ title: event.title, date: event.date, venue: publicVenue(venue), plan: layoutOnly(event.hall) });
});

app.get('/api/lookup/:token/search', (req, res) => {
    const event = byLookupToken(req.params.token);
    if (!event) return res.status(404).json({ code: 'not-found' });
    const query = String(req.query.q || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (query.length < 2) return res.json([]);
    const matches = event.hall.guests
        .filter(g => g.tableId !== undefined && g.seat !== undefined && String(g.name).toLowerCase().includes(query))
        .slice(0, 8)
        .map(g => ({ name: g.name, tableId: g.tableId }));
    res.json(matches);
});

// ---------------------------------------------------------------------------
// One-time import of the hall saved by the first version of the app
// ---------------------------------------------------------------------------

async function importLegacyHall(venueId) {
    if (db.events.length > 0 || !LEGACY_FILE) return;
    let legacy;
    try {
        legacy = JSON.parse(await fs.readFile(LEGACY_FILE, 'utf8'));
    } catch {
        return; // nothing to import
    }
    if (!isObject(legacy) || !Array.isArray(legacy.tables) || legacy.tables.length === 0) return;

    const guests = [];
    const tables = legacy.tables.map(({ guests: names, ...table }) => {
        for (const [seat, name] of Object.entries(isObject(names) ? names : {})) {
            if (typeof name === 'string' && name.trim())
                guests.push({ id: id(), name: name.trim(), tableId: table.id, seat: Number(seat) });
        }
        return table;
    });
    db.events.push({
        id: id(),
        venueId,
        title: 'Իմ սրահը',
        date: '',
        hall: {
            tables,
            elements: [],
            guests,
            groups: [
                { id: id(), name: 'Հարսի կողմ', color: '#c2536d' },
                { id: id(), name: 'Փեսայի կողմ', color: '#3f7cac' },
                { id: id(), name: 'Ընկերներ', color: '#6f9a54' },
                { id: id(), name: 'Գործընկերներ', color: '#c08a2e' },
            ],
            bgGradients: legacy.bgGradients || { color1: '', color2: '' } },
        version: 1,
        shareToken: token(),
        lookupToken: token(),
        createdAt: now(),
        updatedAt: now(),
    });
    console.log(`Imported the previous hall (${tables.length} tables, ${guests.length} guests)`);
}

// ---------------------------------------------------------------------------
// Frontend: the built app (wedding-project/dist) is served from the same origin
// ---------------------------------------------------------------------------

const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'wedding-project', 'dist');
app.use('/api', (req, res) => res.status(404).json({ code: 'not-found' }));
app.use(express.static(FRONTEND_DIR, { index: 'index.html', maxAge: '1h' }));
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'), error => error && next());
});

loadDb().then(() => {
    app.listen(PORT, () => console.log(`Backend server is running on http://localhost:${PORT}`));
});
