/**
 * WeSuccess Centralized Auth Client
 * Connects to wesuccess.vn Auth API
 * Features: Single device policy, device fingerprint, session management
 */

const AUTH_API_BASE = 'https://wesuccess.vn/api/auth';
const STORAGE_KEY = 'wesuccess_auth';
const AUTH_COOKIE = 'wesuccess_token';

/**
 * Generate simple device fingerprint (browser-based)
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

  // Simple hash
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * If we're on a *.wesuccess.app sub-app, return ".wesuccess.app" so the cookie is shared
 * across all sub-apps (one login covers them all). Returns empty string for other hosts
 * (vercel.app preview URLs, localhost) so the cookie stays scoped to that host.
 */
function authCookieDomainAttr(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname.endsWith('.wesuccess.app') ? '; domain=.wesuccess.app' : '';
}

/**
 * Set cookie with token for middleware access
 */
function setAuthCookie(token: string): void {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString(); // 7 days
  document.cookie = `${AUTH_COOKIE}=${token}; path=/; expires=${expires}; SameSite=Lax${authCookieDomainAttr()}`;
}

/**
 * Clear auth cookie
 */
function clearAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${authCookieDomainAttr()}`;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  bundleAccess: string[];
}

export interface AuthSession {
  token: string;
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
 * Login with email and password (creates new session, invalidates others)
 */
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string; session?: AuthSession }> {
  try {
    const fingerprint = generateFingerprint();

    const response = await fetch(`${AUTH_API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for cookies
      body: JSON.stringify({ email, password, device_fingerprint: fingerprint }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Đăng nhập thất bại' };
    }

    const session: AuthSession = {
      token: data.token,
      user: data.user,
      sessionId: data.session?.id,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuthCookie(data.token);

    return { success: true, session };
  } catch (error) {
    console.error('[WeSuccess Auth] Login error:', error);
    return { success: false, error: 'Không thể kết nối đến server' };
  }
}

/**
 * Logout - clear session locally and on server
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${AUTH_API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    console.error('[WeSuccess Auth] Logout error:', err);
  }
  localStorage.removeItem(STORAGE_KEY);
  clearAuthCookie();
}

/**
 * Read a cookie value by name from document.cookie.
 */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(c => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Get current session from localStorage
 */
export function getSession(): AuthSession | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * If localStorage is empty but a shared `wesuccess_token` cookie is present
 * (set by another sub-app on the same parent domain), rebuild the local session
 * by calling /auth/me. Returns the restored session, or null if no cookie or it's invalid.
 */
export async function hydrateFromCookie(): Promise<AuthSession | null> {
  if (getSession()) return getSession();

  const token = readCookie(AUTH_COOKIE);
  if (!token) return null;

  try {
    const response = await fetch(`${AUTH_API_BASE}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      credentials: 'include',
    });

    const data = await response.json();
    if (!response.ok || !data.success || !data.user) return null;

    const session: AuthSession = { token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

/**
 * Verify token validity with server
 */
export async function verifySession(): Promise<{ valid: boolean; user?: AuthUser }> {
  const session = getSession();
  if (!session) return { valid: false };

  try {
    const response = await fetch(`${AUTH_API_BASE}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      await logout();
      return { valid: false };
    }

    return { valid: true, user: data.user };
  } catch {
    return { valid: false };
  }
}

/**
 * Get list of active sessions for current user
 */
export async function getSessions(): Promise<SessionInfo[]> {
  const session = getSession();
  if (!session) return [];

  try {
    const response = await fetch(`${AUTH_API_BASE}/sessions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return data.success ? data.sessions : [];
  } catch {
    return [];
  }
}

/**
 * Revoke specific session
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const session = getSession();
  if (!session) return false;

  try {
    const response = await fetch(`${AUTH_API_BASE}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.token}`,
      },
      credentials: 'include',
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Logout from all devices except current
 */
export async function logoutAllDevices(): Promise<number> {
  const session = getSession();
  if (!session) return 0;

  try {
    const response = await fetch(`${AUTH_API_BASE}/sessions?except_current=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.token}`,
      },
      credentials: 'include',
    });

    const data = await response.json();
    return data.success ? data.revoked_count : 0;
  } catch {
    return 0;
  }
}

/**
 * Check if user has access to bundle
 */
export function hasAccess(bundleSlug: string = 'real-life-bundle'): boolean {
  const session = getSession();
  if (!session) return false;
  return session.user.bundleAccess.includes(bundleSlug);
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders(): HeadersInit {
  const session = getSession();
  if (!session) return {};
  return { 'Authorization': `Bearer ${session.token}` };
}