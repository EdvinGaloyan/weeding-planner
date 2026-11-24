import { useEffect, useState } from 'react';
import { readJSON, writeJSON } from '../utils/storage.ts';

/**
 * useState that is remembered in localStorage (for small UI preferences).
 * Invalid or missing stored values fall back to `initial`.
 */
export function usePersistentState<T>(key: string, initial: T, validate: (value: unknown) => value is T) {
    const [value, setValue] = useState<T>(() => readJSON(key, validate) ?? initial);

    useEffect(() => {
        writeJSON(key, value);
    }, [key, value]);

    return [value, setValue] as const;
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
