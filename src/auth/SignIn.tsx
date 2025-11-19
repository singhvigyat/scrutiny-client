// src/auth/SignIn.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "./AuthProvider";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { LogIn, AlertCircle } from "lucide-react";

type LocationState = {
  from?: { pathname: string };
};

export const SignIn: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state || {}) as LocationState;
  const auth = useAuthContext();

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const getApiBase = () => (BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api");

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    console.log("🔵 [SignIn] Starting sign-in...");

    try {
      // 1) Sign in with Supabase to obtain a session/access token
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("🔴 [Supabase] Error:", error);
        setMsg(error.message);
        setLoading(false);
        return;
      }

      const session = (data as any)?.session ?? null;
      const accessToken = session?.access_token ?? null;

      // 2) Call your backend /api/auth/me with the access token.
      const apiBase = getApiBase();
      const meUrl = `${apiBase}/api/auth/me`;

      try {
        const resp = await fetch(meUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        const text = await resp.text();
        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (parseErr) {
          console.error("🔴 [Backend] JSON parse error:", parseErr);
          setMsg(`Invalid server response: ${text}`);
        }

        if (!resp.ok) {
          const errMsg = json?.message ?? `Status ${resp.status}`;
          setMsg(`Server error: ${errMsg}`);
        }

        const role: string | undefined = json?.user?.role;

        // Set the role in AuthProvider synchronously BEFORE navigation to avoid races.
        auth.setRole(role ?? null);

        // If there was an original intended route, go there first
        const intended = locState?.from?.pathname;
        if (intended) {
          navigate(intended);
          setLoading(false);
          return;
        }

        // Navigate based on role from server response
        if (role === "student") {
          navigate("/student");
        } else if (role === "teacher") {
          navigate("/teacher");
        } else {
          navigate("/dashboard");
        }
      } catch (backendErr: any) {
        // Backend request failed (network, CORS, etc.)
        console.error("🔴 [Backend] /api/auth/me request failed:", backendErr);
        setMsg("Signed in locally but failed to contact server for profile. Redirecting to dashboard.");

        // fallback navigation even if backend failed
        const intended = locState?.from?.pathname;
        if (intended) {
          navigate(intended);
        } else {
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      console.error("🔴 [SignIn] Unexpected error:", err);
      setMsg(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Sign in to access your dashboard</p>
      </div>

      <form onSubmit={onSignIn} className="space-y-6">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {msg && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {msg}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full" icon={<LogIn className="w-4 h-4" />}>
          Sign In
        </Button>
      </form>
    </div>
  );
};

export default SignIn;
