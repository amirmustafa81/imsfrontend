"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { clearStoredToken, getStoredToken, setStoredToken } from "@/lib/auth-storage";

type AuthRole = {
  id: number;
  name: string;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  employee_code?: string | null;
  designation?: string | null;
  department_id?: number | null;
  access_scope?: string | null;
  status?: string | null;
  roles?: AuthRole[];
  permissions?: string[];
};

type LoginPayload = {
  email: string;
  password: string;
};

type AuthContextValue = {
  token: string;
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();

    if (!currentToken) {
      setToken("");
      setUser(null);
      setLoading(false);
      return;
    }

    setToken(currentToken);

    try {
      const response = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(response.data.user);
    } catch {
      clearStoredToken();
      setToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const response = await api.post<{ token: string; user: AuthUser }>("/auth/login", payload);
      setStoredToken(response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      await refreshUser();
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local logout should still happen if the token is already expired server-side.
    } finally {
      clearStoredToken();
      setToken("");
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      refreshUser,
    }),
    [loading, login, logout, refreshUser, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
