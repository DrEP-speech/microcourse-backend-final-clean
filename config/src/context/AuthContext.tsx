"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getToken,
  setToken,
  clearToken,
  logout as logoutToken,
  me as fetchMe,
  type User,
} from "@/lib/auth";

type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // actions
  refresh: () => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const t = getToken();
      setTokenState(t);

      if (!t) {
        setUser(null);
        return;
      }

      const u = await fetchMe();
      setUser(u);

      // If fetchMe returned null, token was invalid/expired and was cleared.
      if (!u) {
        setTokenState(getToken());
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load user session.");
      setUser(null);
      setTokenState(getToken());
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithToken = async (newToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      setToken(newToken);
      setTokenState(newToken);

      // Try fetching user immediately after token set
      const u = await fetchMe();
      setUser(u);

      if (!u) {
        // Token invalid
        clearToken();
        setTokenState(null);
        throw new Error("Login token invalid or expired.");
      }
    } catch (e: any) {
      setError(e?.message || "Login failed.");
      setUser(null);
      setTokenState(getToken());
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutToken(); // clears token
    setUser(null);
    setTokenState(null);
    setError(null);
    setIsLoading(false);
  };

  useEffect(() => {
    // On first mount, hydrate session from localStorage token + /me
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(() => {
    const t = token ?? getToken();
    return {
      user,
      token: t,
      isAuthenticated: Boolean(t && user),
      isLoading,
      error,
      refresh,
      loginWithToken,
      logout,
    };
  }, [user, token, isLoading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
