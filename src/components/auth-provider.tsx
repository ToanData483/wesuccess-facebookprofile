"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSession, verifySession, logout, type AuthUser, type AuthSession } from "@/lib/wesuccess-auth";

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
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

      const currentSession = getSession();

      if (!currentSession) {
        setLoading(false);
        return;
      }

      // Verify token with server
      const result = await verifySession();

      if (result.valid && result.user) {
        setUser(result.user);
        setSession(currentSession);
      } else {
        // Invalid token, clear and redirect
        logout();
        router.push("/login");
      }

      setLoading(false);
    }

    checkAuth();
  }, [pathname, router]);

  const handleLogout = () => {
    logout();
    setUser(null);
    setSession(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}