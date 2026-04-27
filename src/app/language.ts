export const LANGUAGE_CHANGED_EVENT = 'app:language-changed';

export type LanguagePreference = 'es' | 'en' | 'pt';

const LANGUAGE_STORAGE_KEY = 'app_language';
const DEFAULT_LANGUAGE: LanguagePreference = 'es';

function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value === 'es' || value === 'en' || value === 'pt';
}

function applyLanguage(preference: LanguagePreference) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.lang = preference;
}

function emitLanguageChanged(preference: LanguagePreference) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<LanguagePreference>(LANGUAGE_CHANGED_EVENT, { detail: preference }));
}

export function getLanguagePreference(): LanguagePreference {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (!isLanguagePreference(storedLanguage)) {
    return DEFAULT_LANGUAGE;
  }

  return storedLanguage;
}

export function setLanguagePreference(preference: LanguagePreference) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  }

  applyLanguage(preference);
  emitLanguageChanged(preference);
}

export function initializeLanguage() {
  applyLanguage(getLanguagePreference());
}
