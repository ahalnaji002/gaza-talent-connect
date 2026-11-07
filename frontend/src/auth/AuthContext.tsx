import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setUnauthorizedHandler } from '../api/client';
import { authApi } from '../api/endpoints';
import type { LoginRequest, UserRole } from '../api/types';

// Demo-grade session storage: the JWT lives in localStorage with its expiry.
// It is never logged. A production app would prefer an httpOnly cookie.
const STORAGE_KEY = 'gtc.session';

interface StoredSession {
  token: string;
  expiresAt: number;
  /** Chooses which pages to show; the API enforces the real permissions. */
  role: UserRole;
}

const ROLES: readonly UserRole[] = ['STUDENT', 'COMPANY'];

/** Landing page for each account type. */
export function homePathFor(role: UserRole): string {
  return role === 'COMPANY' ? '/company' : '/dashboard';
}

export type SessionEndReason = 'expired' | 'logout' | null;

interface AuthContextValue {
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  sessionEndReason: SessionEndReason;
  login: (credentials: LoginRequest) => Promise<UserRole>;
  logout: () => void;
  clearSessionEndReason: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.role ||
      !ROLES.includes(parsed.role)
    ) {
      // Sessions saved before roles existed have no role: log in again.
      return null;
    }
    if (parsed.expiresAt <= Date.now()) return null;
    return { token: parsed.token, expiresAt: parsed.expiresAt, role: parsed.role };
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the session then lasts for this tab only.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(readStoredSession);
  const [sessionEndReason, setSessionEndReason] = useState<SessionEndReason>(null);

  const endSession = useCallback((reason: SessionEndReason) => {
    writeStoredSession(null);
    setSession(null);
    setSessionEndReason(reason);
  }, []);

  // Any protected request answered with 401 means the token is no longer valid.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession('expired'));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // End the session automatically when the token's lifetime runs out.
  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    const timer = window.setTimeout(() => endSession('expired'), Math.max(remaining, 0));
    return () => window.clearTimeout(timer);
  }, [session, endSession]);

  // Keep several open tabs in sync with login/logout.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSession(readStoredSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await authApi.login(credentials);
    const next: StoredSession = {
      token: result.accessToken,
      expiresAt: Date.now() + result.expiresIn * 1000,
      role: result.role,
    };
    writeStoredSession(next);
    setSession(next);
    setSessionEndReason(null);
    return result.role;
  }, []);

  const logout = useCallback(() => endSession('logout'), [endSession]);
  const clearSessionEndReason = useCallback(() => setSessionEndReason(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.token ?? null,
      role: session?.role ?? null,
      isAuthenticated: session !== null,
      sessionEndReason,
      login,
      logout,
      clearSessionEndReason,
    }),
    [session, sessionEndReason, login, logout, clearSessionEndReason],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Returns the token for protected pages; RequireAuth guarantees it exists. */
export function useToken(): string {
  const { token } = useAuth();
  if (!token) throw new Error('useToken requires an authenticated session');
  return token;
}
