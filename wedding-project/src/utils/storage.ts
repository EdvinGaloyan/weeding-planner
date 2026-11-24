/**
 * Safe localStorage helpers.
 *
 * localStorage can throw (private mode, blocked storage, quota exceeded) and can
 * contain anything (older app versions, manual edits). Every read is therefore
 * wrapped in try/catch and validated, and every write reports whether it worked.
 */

const PREFIX = 'wedding-planner:';

export function readJSON<T>(key: string, validate: (value: unknown) => value is T): T | null {
    try {
        const raw = window.localStorage.getItem(PREFIX + key);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        return validate(parsed) ? parsed : null;
    } catch (error) {
        console.warn(`[storage] Could not read "${key}"`, error);
        return null;
    }
}

export function writeJSON(key: string, value: unknown): boolean {
    try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn(`[storage] Could not write "${key}"`, error);
        return false;
    }
}

export function readString(key: string): string | null {
    try {
        return window.localStorage.getItem(PREFIX + key);
    } catch {
        return null;
    }
}

export function removeKey(key: string): void {
    try {
        window.localStorage.removeItem(PREFIX + key);
    } catch {
        /* storage unavailable */
    }
}

export function writeString(key: string, value: string): void {
    try {
        window.localStorage.setItem(PREFIX + key, value);
    } catch {
        /* storage unavailable — preference simply isn't remembered */
    }
}
