import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api } from "../api/client";

export type Role = "ADMIN" | "MANAGER" | "AGENT" | "DEVELOPER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthAccount {
  id: string;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  account: AuthAccount | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { accountName: string; name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("zenvia_token"));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
      setAccount(res.data.account);
    } catch {
      setUser(null);
      setAccount(null);
      setToken(null);
      localStorage.removeItem("zenvia_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, [token, fetchMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("zenvia_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(
    async (data: { accountName: string; name: string; email: string; password: string }) => {
      const res = await api.post("/auth/register", data);
      localStorage.setItem("zenvia_token", res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setAccount(res.data.account);
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("zenvia_token");
    setToken(null);
    setUser(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, account, loading, login, register, logout }),
    [token, user, account, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
