import React, { createContext, useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebaseClient";
import { authService } from "../services/authService";
import type { User } from "../types";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const updated = await authService.getProfile(auth.currentUser);
      setUser(updated);
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    // Generous fallback timeout (30 seconds) to prevent premature session loss on slow connections or cold starts
    const timeout = window.setTimeout(() => {
      if (!active) return;
      if (auth.currentUser) {
        // User is still authenticated in Firebase Auth, do not terminate session
        return;
      }
      setLoading(false);
    }, 30000);

    // Configure durable browser persistence before the first auth observation.
    // This prevents the brief signed-out state that used to create redirect loops.
    void authService
      .initialize()
      .then(() => {
        if (!active) return;
        unsubscribe = authService.observe((u, err) => {
          if (!active) return;
          window.clearTimeout(timeout);
          setUser(u);
          setLoading(false);
          setError(err || null);
        });
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setLoading(false);
        setError("SESSION_INITIALIZATION_FAILED");
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      void refreshUser();
    };
    window.addEventListener(
      "ensat:permissions-updated",
      handlePermissionsUpdated,
    );
    return () => {
      window.removeEventListener(
        "ensat:permissions-updated",
        handlePermissionsUpdated,
      );
    };
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
