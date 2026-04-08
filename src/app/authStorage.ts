export interface AuthUser {
  id?: number;
  customerId?: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  status?: 'active' | 'away' | 'busy' | 'offline';
  [key: string]: unknown;
}

// Extrae el storeId del JWT si no viene en el usuario
export function getStoreIdFromToken(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.storeId || null;
  } catch {
    return null;
  }
}
export const AUTH_CHANGED_EVENT = 'app:auth-changed';

interface SaveAuthSessionInput {
  username: string;
  user?: AuthUser;
  accessToken?: string;
  rememberMe?: boolean;
}

interface AuthSession {
  userEmail: string;
  user?: AuthUser;
  accessToken?: string;
  rememberMe: boolean;
  expiresAt?: number;
}

const AUTH_KEYS = {
  isAuthenticated: 'isAuthenticated',
  userEmail: 'userEmail',
  accessToken: 'access_token',
  loggedUser: 'loggedUser',
  expiresAt: 'auth_expires_at',
} as const;

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;
const CAPACITOR_AUTH_SESSION_KEY = 'auth_session';

let initialized = false;

type PreferencesPlugin = {
  get: (options: { key: string }) => Promise<{ value: string | null }>;
  set: (options: { key: string; value: string }) => Promise<void>;
  remove: (options: { key: string }) => Promise<void>;
};

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        Preferences?: PreferencesPlugin;
      };
    };
  }
}

function getWebStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return {
    local: window.localStorage,
    session: window.sessionStorage,
  };
}

function emitAuthChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function isNativePlatform() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function getPreferencesPlugin(): PreferencesPlugin | null {
  return window.Capacitor?.Plugins?.Preferences ?? null;
}

function parseStoredUser(rawUser: string | null): AuthUser | undefined {
  if (!rawUser) {
    return undefined;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return undefined;
  }
}

function parsePersistedSession(rawSession: string | null): AuthSession | null {
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as AuthSession;
    if (!parsed.userEmail) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readSessionFromStorage(storage: Storage): AuthSession | null {
  const isAuthenticated = storage.getItem(AUTH_KEYS.isAuthenticated) === 'true';

  if (!isAuthenticated) {
    return null;
  }

  const expiresAtRaw = storage.getItem(AUTH_KEYS.expiresAt);

  if (expiresAtRaw) {
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      return null;
    }
  }

  const accessToken = storage.getItem(AUTH_KEYS.accessToken) ?? undefined;
  const user = parseStoredUser(storage.getItem(AUTH_KEYS.loggedUser));

  if (!accessToken && !user) {
    return null;
  }

  return {
    userEmail: storage.getItem(AUTH_KEYS.userEmail) ?? '',
    user,
    accessToken,
    rememberMe: Boolean(expiresAtRaw),
    expiresAt: expiresAtRaw ? Number(expiresAtRaw) : undefined,
  };
}

function removeAuthKeys(storage: Storage) {
  storage.removeItem(AUTH_KEYS.isAuthenticated);
  storage.removeItem(AUTH_KEYS.userEmail);
  storage.removeItem(AUTH_KEYS.accessToken);
  storage.removeItem(AUTH_KEYS.loggedUser);
  storage.removeItem(AUTH_KEYS.expiresAt);
}

function writeSessionToStorage(storage: Storage, session: AuthSession) {
  storage.setItem(AUTH_KEYS.isAuthenticated, 'true');
  storage.setItem(AUTH_KEYS.userEmail, session.userEmail);

  if (session.accessToken) {
    storage.setItem(AUTH_KEYS.accessToken, session.accessToken);
  }

  if (session.user) {
    storage.setItem(AUTH_KEYS.loggedUser, JSON.stringify(session.user));
  }

  if (session.expiresAt) {
    storage.setItem(AUTH_KEYS.expiresAt, String(session.expiresAt));
  }
}

async function saveCapacitorSession(session: AuthSession | null) {
  const preferences = getPreferencesPlugin();
  if (!isNativePlatform() || !preferences) {
    return;
  }

  if (!session || !session.rememberMe) {
    await preferences.remove({ key: CAPACITOR_AUTH_SESSION_KEY });
    return;
  }

  await preferences.set({
    key: CAPACITOR_AUTH_SESSION_KEY,
    value: JSON.stringify(session),
  });
}

export async function initializeAuthStorage() {
  if (initialized) {
    return;
  }

  initialized = true;
  const webStorage = getWebStorage();
  if (!webStorage) {
    return;
  }

  const preferences = getPreferencesPlugin();
  if (!isNativePlatform() || !preferences) {
    return;
  }

  removeAuthKeys(webStorage.local);
  removeAuthKeys(webStorage.session);

  const { value } = await preferences.get({ key: CAPACITOR_AUTH_SESSION_KEY });
  const persistedSession = parsePersistedSession(value);

  if (!persistedSession) {
    return;
  }

  if (persistedSession.expiresAt && Date.now() > persistedSession.expiresAt) {
    await preferences.remove({ key: CAPACITOR_AUTH_SESSION_KEY });
    return;
  }

  writeSessionToStorage(webStorage.local, persistedSession);
}

export function clearAuthSession() {
  const webStorage = getWebStorage();
  if (!webStorage) {
    return;
  }

  removeAuthKeys(webStorage.local);
  removeAuthKeys(webStorage.session);
  void saveCapacitorSession(null);
  emitAuthChanged();
}

export function saveAuthSession({ username, user, accessToken, rememberMe = false }: SaveAuthSessionInput) {
  const webStorage = getWebStorage();
  if (!webStorage) {
    return;
  }

  // ⚠️ Limpiar sin emitir el evento — evita que startRealtimeChannel
  // se llame antes de que la sesión esté guardada
  removeAuthKeys(webStorage.local);
  removeAuthKeys(webStorage.session);
  void saveCapacitorSession(null);

  let userWithStoreId = user;
  if (accessToken && user && !('storeId' in user)) {
    const storeId = getStoreIdFromToken(accessToken);
    if (storeId) {
      userWithStoreId = { ...user, storeId };
    }
  }

  const session: AuthSession = {
    userEmail: username,
    user: userWithStoreId,
    accessToken,
    rememberMe,
    expiresAt: rememberMe ? Date.now() + THIRTY_DAYS_IN_MS : undefined,
  };

  const targetStorage = rememberMe ? webStorage.local : webStorage.session;
  writeSessionToStorage(targetStorage, session);
  void saveCapacitorSession(session);
  emitAuthChanged(); // ✅ Se emite una sola vez, con la sesión ya guardada
}

export function getAuthSession(): AuthSession | null {
  const webStorage = getWebStorage();
  if (!webStorage) {
    return null;
  }

  const localSession = readSessionFromStorage(webStorage.local);
  if (localSession) {
    console.log(localSession, 'session local');
    return localSession;
  }

  const sessionSession = readSessionFromStorage(webStorage.session);
  if (sessionSession) {
    console.log(localSession, 'session local');
    return sessionSession;
  }

  removeAuthKeys(webStorage.local);
  removeAuthKeys(webStorage.session);
  return null;
}

export function isUserAuthenticated() {
  return Boolean(getAuthSession());
}

export function getLoggedUser() {
  return getAuthSession()?.user ?? null;
}