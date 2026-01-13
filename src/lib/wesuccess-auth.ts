/**
 * WeSuccess Centralized Auth Client
 * Connects to wesuccess.vn Auth API
 */

const AUTH_API_BASE = 'https://wesuccess.vn/api/auth';
const STORAGE_KEY = 'wesuccess_auth';
const AUTH_COOKIE = 'wesuccess_token';

/**
 * Set cookie with token for middleware access
 */
function setAuthCookie(token: string): void {
  // Set cookie to expire in 1 hour (matching JWT expiration)
  const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
  document.cookie = `${AUTH_COOKIE}=${token}; path=/; expires=${expires}; SameSite=Lax`;
}

/**
 * Clear auth cookie
 */
function clearAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string; session?: AuthSession }> {
  try {
    const response = await fetch(`${AUTH_API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Đăng nhập thất bại' };
    }

    const session: AuthSession = { token: data.token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuthCookie(data.token);

    return { success: true, session };
  } catch (error) {
    console.error('[WeSuccess Auth] Login error:', error);
    return { success: false, error: 'Không thể kết nối đến server' };
  }
}

/**
 * Logout - clear session
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearAuthCookie();
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
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      logout();
      return { valid: false };
    }

    return { valid: true, user: data.user };
  } catch {
    return { valid: false };
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