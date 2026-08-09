import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { AdminUser } from "../lib/types";

const STORAGE_KEY = "civicfield.demo.session";

interface Session {
  token: string;
  user: AdminUser;
}

interface AuthContextValue {
  token: string | null;
  user: AdminUser | null;
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  const login = useCallback(async () => {
    const { token, user } = await api.login();
    const next = { token, user };
    setSession(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token: session?.token ?? null, user: session?.user ?? null, isAdmin: !!session, login, logout }),
    [session, login, logout]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
