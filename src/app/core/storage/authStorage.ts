export interface AuthUser {
  id?: number;
  customerId?: number;
  storeId?: number | string;
  headquarterId?: number | string;
  store?: {
    id?: number | string;
    name?: string;
    slug?: string;
    profile_image_url?: string | null;
    profileImageUrl?: string | null;
    offers_delivery?: boolean;
    offersDelivery?: boolean;
    offers_pickup?: boolean;
    offersPickup?: boolean;
    [key: string]: unknown;
  } | null;
  subscription?: {
    id?: number | string;
    storeId?: number | string;
    planId?: number | string;
    startDate?: string;
    endDate?: string;
    payment?: number;
    statusId?: number | string;
    Plan?: {
      id?: number | string;
      name?: string;
      description?: string;
      isFree?: boolean;
    };
    Status?: {
      id?: number | string;
      name?: string;
    };
    [key: string]: unknown;
  } | null;
  hasSubscription?: boolean;
  storeName?: string;
  profile_image_url?: string;
  profileImageUrl?: string;
  token?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  status?: 'active' | 'away' | 'busy' | 'offline';
  presenceStatus?: 'active' | 'away' | 'busy' | 'offline';
  lastPresenceAt?: string;
  sessionVersion?: number;
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
export const AUTH_EXPIRED_EVENT = 'app:auth-expired';
const ACTIVE_BROWSER_SESSION_KEY = 'auth_active_browser_session_id';
const CURRENT_BROWSER_SESSION_KEY = 'auth_current_browser_session_id';

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

function createBrowserSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrentBrowserSessionId() {
  return getWebStorage()?.session.getItem(CURRENT_BROWSER_SESSION_KEY) ?? null;
}

function getActiveBrowserSessionId() {
  return getWebStorage()?.local.getItem(ACTIVE_BROWSER_SESSION_KEY) ?? null;
}

function isCurrentBrowserSessionActive() {
  const activeSessionId = getActiveBrowserSessionId();
  const currentSessionId = getCurrentBrowserSessionId();

  return !activeSessionId || (Boolean(currentSessionId) && activeSessionId === currentSessionId);
}

function emitAuthChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function emitAuthExpired() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
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

function readLocalSessionFromStorage(storage: Storage): AuthSession | null {
  if (!isCurrentBrowserSessionActive()) {
    return null;
  }

  return readSessionFromStorage(storage);
}

function removeAuthKeys(storage: Storage) {
  storage.removeItem(AUTH_KEYS.isAuthenticated);
  storage.removeItem(AUTH_KEYS.userEmail);
  storage.removeItem(AUTH_KEYS.accessToken);
  storage.removeItem(AUTH_KEYS.loggedUser);
  storage.removeItem(AUTH_KEYS.expiresAt);
}

function removeCurrentTabAuthKeys() {
  const webStorage = getWebStorage();
  if (!webStorage) {
    return;
  }

  removeAuthKeys(webStorage.session);
  webStorage.session.removeItem(CURRENT_BROWSER_SESSION_KEY);
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

  const shouldClearSharedSession = isCurrentBrowserSessionActive();
  if (shouldClearSharedSession) {
    removeAuthKeys(webStorage.local);
  }
  removeAuthKeys(webStorage.session);
  if (shouldClearSharedSession) {
    webStorage.local.removeItem(ACTIVE_BROWSER_SESSION_KEY);
  }
  webStorage.session.removeItem(CURRENT_BROWSER_SESSION_KEY);
  void saveCapacitorSession(null);
  emitAuthChanged();
}

export function expireAuthSession() {
  if (!isCurrentBrowserSessionActive()) {
    removeCurrentTabAuthKeys();
    emitAuthChanged();
  } else {
    clearAuthSession();
  }
  emitAuthExpired();
}

export function expireCurrentTabAuthSession() {
  removeCurrentTabAuthKeys();
  emitAuthChanged();
  emitAuthExpired();
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
  const browserSessionId = createBrowserSessionId();
  webStorage.session.setItem(CURRENT_BROWSER_SESSION_KEY, browserSessionId);
  webStorage.local.setItem(ACTIVE_BROWSER_SESSION_KEY, browserSessionId);

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

  const localSession = readLocalSessionFromStorage(webStorage.local);
  if (localSession) {
    return localSession;
  }

  const sessionSession = readSessionFromStorage(webStorage.session);
  if (sessionSession) {
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

export function updateLoggedUser(patch: Partial<AuthUser>) {
  const webStorage = getWebStorage();
  if (!webStorage) {
    return;
  }

  const currentSession = getAuthSession();
  if (!currentSession?.user) {
    return;
  }

  const nextUser = {
    ...currentSession.user,
    ...patch,
  };

  const updatedSession = {
    ...currentSession,
    user: nextUser,
  };

  removeAuthKeys(webStorage.local);
  removeAuthKeys(webStorage.session);

  const targetStorage = currentSession.rememberMe ? webStorage.local : webStorage.session;
  writeSessionToStorage(targetStorage, updatedSession);
  void saveCapacitorSession(updatedSession);
  emitAuthChanged();
}

export function isAuthStorageEventForReplacedSession(event: StorageEvent) {
  if (event.key !== ACTIVE_BROWSER_SESSION_KEY || !event.newValue) {
    return false;
  }

  const currentSessionId = getCurrentBrowserSessionId();
  return Boolean(currentSessionId) && event.newValue !== currentSessionId;
}
