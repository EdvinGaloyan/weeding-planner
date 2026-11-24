import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import languages from './assets/available-languages.json';
import { readString, writeString } from './utils/storage.ts';

const LANGUAGE_KEY = 'language';
const DEFAULT_LANGUAGE = 'am';

const isAvailable = (lang: string | null): lang is string =>
    !!lang && languages.some((language: { brief: string }) => language.brief === lang);

// Translation files are split into separate chunks and loaded on demand
const translationLoaders = import.meta.glob<{ default: Record<string, string> }>('./assets/i18n/*.json');

async function loadLanguage(lang: string) {
    if (i18n.hasResourceBundle(lang, 'translation')) return;
    const loader = translationLoaders[`./assets/i18n/${lang}.json`];
    if (!loader) throw new Error(`Missing translation file for "${lang}"`);
    const module = await loader();
    i18n.addResourceBundle(lang, 'translation', module.default, true, true);
}

const storedLanguage = readString(LANGUAGE_KEY);
const initialLanguage = isAvailable(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;

i18n.use(initReactI18next).init({
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
});

export const changeAppLanguage = async (lang: string) => {
    if (!isAvailable(lang)) {
        console.warn(`Language '${lang}' is not available.`);
        return;
    }
    await loadLanguage(lang);
    await i18n.changeLanguage(lang);
    document.documentElement.lang = lang === 'am' ? 'hy' : lang;
    writeString(LANGUAGE_KEY, lang);
};

changeAppLanguage(initialLanguage);

export default i18n;
