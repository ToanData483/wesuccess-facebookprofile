/**
 * WeSuccess Centralized Auth Client
 * Connects to wesuccess.vn Auth API.
 *
 * Auth model: server-issued HttpOnly cookie `ws_session` scoped to .wesuccess.app.
 * The cookie is the single source of truth — sub-apps never see the raw token in JS.
 * `credentials: 'include'` on every fetch lets the browser carry the cookie cross-subdomain.
 * localStorage caches only user info for fast first paint; never the token.
 */

// Auth API runs on auth.wesuccess.app (same eTLD+1 as sub-apps).
// This is critical: cookies set by the API at .wesuccess.app are only accepted
// by the browser if the API host is itself within .wesuccess.app. wesuccess.vn
// can't set cookies for .wesuccess.app (cross-domain attack prevention).
const AUTH_API_BASE = 'https://auth.wesuccess.app/api/auth';
const USER_CACHE_KEY = 'wesuccess_user';

/**
 * Generate simple device fingerprint (browser-based).
 * Used by the server to deduplicate sessions per device — not a security boundary.
 */
function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ];

  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  bundleAccess: string[];
}

export interface AuthSession {
  user: AuthUser;
  sessionId?: string;
}

export interface SessionInfo {
  id: string;
  device_name: string | null;
  ip_address: string;
  is_current: boolean;
  last_activity_at: string;
  created_at: string;
}

/**
 * Cache user info locally (NOT the token) so the next page load can render immediately
 * while we re-validate against the server.
 */
function cacheUser(user: AuthUser): void {
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch { /* quota / private mode */ }
}

function readCachedUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(USER_CACHE_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
}

function clearCachedUser(): void {
  try { localStorage.removeItem(USER_CACHE_KEY); } catch { /* ignore */ }
}

/**
 * Login with email and password. Server sets the HttpOnly ws_session cookie.
 */
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string; session?: AuthSession }> {
  try {
    const fingerprint = generateFingerprint();
    const response = await fetch(`${AUTH_API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, device_fingerprint: fingerprint }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Đăng nhập thất bại' };
    }

    cacheUser(data.user);
    return { success: true, session: { user: data.user, sessionId: data.session?.id } };
  } catch (error) {
    console.error('[WeSuccess Auth] Login error:', error);
    return { success: false, error: 'Không thể kết nối đến server' };
  }
}

/**
 * Logout - server clears the cookie; we just drop the cached user.
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${AUTH_API_BASE}/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.error('[WeSuccess Auth] Logout error:', err);
  }
  clearCachedUser();
}

/**
 * Synchronous: read the cached user (no server round-trip). Returns null if not yet hydrated.
 * For the actual auth check, use verifySession().
 */
export function getCachedUser(): AuthUser | null {
  return readCachedUser();
}

/**
 * Verify the session by asking the server. The browser sends the HttpOnly cookie automatically
 * via credentials: 'include'. This works across .wesuccess.app sub-apps because the cookie is
 * scoped to the parent domain — so a user logged in on one sub-app is recognized everywhere.
 *
 * Returns the user on success; on failure, clears the local cache.
 */
export async function verifySession(): Promise<{ valid: boolean; user?: AuthUser }> {
  try {
    const response = await fetch(`${AUTH_API_BASE}/me`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();
    if (!response.ok || !data.success || !data.user) {
      clearCachedUser();
      return { valid: false };
    }

    cacheUser(data.user);
    return { valid: true, user: data.user };
  } catch {
    return { valid: false };
  }
}

export async function getSessions(): Promise<SessionInfo[]> {
  try {
    const response = await fetch(`${AUTH_API_BASE}/sessions`, {
      method: 'GET',
      credentials: 'include',
    });
    const data = await response.json();
    return data.success ? data.sessions : [];
  } catch {
    return [];
  }
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${AUTH_API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function logoutAllDevices(): Promise<number> {
  try {
    const response = await fetch(`${AUTH_API_BASE}/sessions?except_current=true`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    return data.success ? data.revoked_count : 0;
  } catch {
    return 0;
  }
}

export function hasAccess(bundleSlug: string = 'real-life-bundle'): boolean {
  const user = readCachedUser();
  return user ? user.bundleAccess.includes(bundleSlug) : false;
}
