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
  hasPermission: (permission: string | string[]) => boolean;
};

const resolveAuthBypass = () => {
  const value = process.env.NEXT_PUBLIC_DISABLE_AUTH;

  if (value === undefined || value === "") {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false;
  }

  return ["true", "1", "on", "yes"].includes(normalized);
};

export const isAuthBypassEnabled = resolveAuthBypass();

const DEMO_USER: AuthUser = {
  id: 0,
  name: "IMS Demo User",
  email: "demo@local",
  employee_code: "DEMO-001",
  designation: "System User",
  access_scope: "university",
  status: "active",
  roles: [
    {
      id: 1,
      name: "Administrator",
    },
  ],
  permissions: ["*"],
};

const AuthContext = createContext<AuthContextValue | null>(null);

const normalizePermissionInput = (value: string) => value.trim().toLowerCase().replace(/:/g, ".");
const permissionAllows = (grantedPermission: string, requiredPermission: string) => {
  const normalizedGranted = normalizePermissionInput(grantedPermission);
  const normalizedRequired = normalizePermissionInput(requiredPermission);

  if (normalizedGranted === "*") {
    return true;
  }

  if (normalizedGranted === normalizedRequired) {
    return true;
  }

  if (normalizedGranted.endsWith(".*") && normalizedRequired.startsWith(normalizedGranted.slice(0, -2))) {
    return true;
  }

  return false;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => (isAuthBypassEnabled ? "demo-token" : ""));
  const [user, setUser] = useState<AuthUser | null>(() => (isAuthBypassEnabled ? DEMO_USER : null));
  const [loading, setLoading] = useState(!isAuthBypassEnabled);

  const activateDemoSession = useCallback(() => {
    setToken("demo-token");
    setUser(DEMO_USER);
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    if (isAuthBypassEnabled) {
      activateDemoSession();
      return;
    }

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
  }, [activateDemoSession]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      if (isAuthBypassEnabled) {
        activateDemoSession();
        return;
      }

      const response = await api.post<{ token: string; user: AuthUser }>("/auth/login", payload);
      setStoredToken(response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      await refreshUser();
    },
    [activateDemoSession, refreshUser],
  );

  const logout = useCallback(async () => {
    if (isAuthBypassEnabled) {
      activateDemoSession();
      return;
    }

    try {
      await api.post("/auth/logout");
    } catch {
      // Local logout should still happen if the token is already expired server-side.
    } finally {
      clearStoredToken();
      setToken("");
      setUser(null);
    }
  }, [activateDemoSession]);

  const hasPermission = useCallback(
    (permission: string | string[]) => {
      const userPermissions = user?.permissions ?? [];

      if (userPermissions.includes("*")) {
        return true;
      }

      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      const normalizedUserPermissions = userPermissions.map(normalizePermissionInput);

      for (const required of requiredPermissions) {
        const normalizedRequired = normalizePermissionInput(required);
        if (normalizedUserPermissions.some((granted) => permissionAllows(granted, normalizedRequired))) {
          return true;
        }
      }

      return false;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      refreshUser,
      hasPermission,
    }),
    [loading, login, logout, refreshUser, token, user, hasPermission],
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
