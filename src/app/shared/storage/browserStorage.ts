const canUseBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export function getStorageItem(key: string, fallback = '') {
  if (!canUseBrowserStorage()) return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function setStorageItem(key: string, value: string) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(key, value);
}

export function removeStorageItem(key: string) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.removeItem(key);
}

export function getJsonStorageItem<T>(key: string, fallback: T): T {
  const rawValue = getStorageItem(key, '');
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

export function setJsonStorageItem<T>(key: string, value: T) {
  setStorageItem(key, JSON.stringify(value));
}
