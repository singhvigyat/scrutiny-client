// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AuthContextType = {
  user: any | null;
  role: string | null;
  roleLoading: boolean;
  setRole: (r: string | null) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  roleLoading: false,
  setRole: () => {},
});

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRoleState] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // setter exposed to let SignIn set the authoritative role immediately
  const setRole = (r: string | null) => {
    setRoleState(r);
    if (typeof window !== "undefined") {
      if (r) localStorage.setItem("role", r);
      else localStorage.removeItem("role");
    }
  };

  useEffect(() => {
    let mounted = true;

    // On mount, try to restore session/user and persisted role quickly
    (async () => {
      try {
        const sessRes = await supabase.auth.getSession();
        const session = sessRes?.data?.session ?? null;
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }

        // Quickly read persisted role if available (fast path)
        const savedRole = typeof window !== "undefined" ? localStorage.getItem("role") : null;
        if (savedRole) {
          setRoleState(savedRole);
        }
      } catch (err) {
        console.warn("[AuthProvider] getSession failed", err);
      }
    })();

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("[AuthProvider] onAuthStateChange:", _event, session?.user ?? null);

      if (!session?.user) {
        // signed out
        setUser(null);
        setRole(null);
        return;
      }

      setUser(session.user);

      // If a role is already persisted, use that; otherwise leave null
      const savedRole = typeof window !== "undefined" ? localStorage.getItem("role") : null;
      if (savedRole) {
        console.log("[AuthProvider] using persisted role:", savedRole);
        setRoleState(savedRole);
        return;
      }

      // Do not eagerly fetch role here — SignIn will set role after contacting backend.
      // But set roleLoading = false (no background fetch).
      setRoleLoading(false);
    });

    return () => {
      mounted = false;
      try {
        listener?.subscription?.unsubscribe?.();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, roleLoading, setRole }}>
      {children}
    </AuthContext.Provider>
  );
};
