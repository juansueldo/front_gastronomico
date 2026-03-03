export const THEME_CHANGED_EVENT = 'app:theme-changed';

export type ThemePreference = 'dark' | 'light' | 'auto';

const THEME_STORAGE_KEY = 'app_theme';
const DEFAULT_THEME: ThemePreference = 'dark';

let systemThemeQuery: MediaQueryList | null = null;
let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'dark' || value === 'light' || value === 'auto';
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyResolvedTheme(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
}

function removeSystemThemeListener() {
  if (!systemThemeQuery || !systemThemeListener) {
    return;
  }

  systemThemeQuery.removeEventListener('change', systemThemeListener);
  systemThemeQuery = null;
  systemThemeListener = null;
}

function setupSystemThemeListener() {
  if (typeof window === 'undefined') {
    return;
  }

  if (systemThemeQuery && systemThemeListener) {
    return;
  }

  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeListener = (event: MediaQueryListEvent) => {
    applyResolvedTheme(event.matches ? 'dark' : 'light');
  };
  systemThemeQuery.addEventListener('change', systemThemeListener);
}

function applyThemePreference(preference: ThemePreference) {
  if (preference === 'auto') {
    setupSystemThemeListener();
    applyResolvedTheme(getSystemTheme());
    return;
  }

  removeSystemThemeListener();
  applyResolvedTheme(preference);
}

function emitThemeChanged(preference: ThemePreference) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGED_EVENT, { detail: preference }));
}

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (!isThemePreference(storedTheme)) {
    return DEFAULT_THEME;
  }

  return storedTheme;
}

export function setThemePreference(preference: ThemePreference) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }

  applyThemePreference(preference);
  emitThemeChanged(preference);
}

export function initializeTheme() {
  applyThemePreference(getThemePreference());
}
