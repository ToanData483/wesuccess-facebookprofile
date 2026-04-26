"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getCachedUser, verifySession, logout, type AuthUser } from "@/lib/wesuccess-auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Optimistic render: paint with cached user while we re-validate against the server.
  // Token lives only in the HttpOnly ws_session cookie — JS never sees it.
  const [user, setUser] = useState<AuthUser | null>(() => getCachedUser());
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      // Skip auth check on login page
      if (pathname === "/login") {
        setLoading(false);
        return;
      }

      // The browser carries ws_session automatically (cookie scoped to .wesuccess.app);
      // /api/auth/me validates it server-side and returns the user.
      const result = await verifySession();

      if (result.valid && result.user) {
        setUser(result.user);
      } else {
        setUser(null);
        router.push("/login");
      }

      setLoading(false);
    }

    checkAuth();
  }, [pathname, router]);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
