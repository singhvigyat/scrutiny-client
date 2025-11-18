// src/auth/SignIn.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthContext } from "./AuthProvider";

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
    console.log("🔵 Email:", email);

    try {
      // 1) Sign in with Supabase to obtain a session/access token
      console.log("🟠 [Supabase] Calling signInWithPassword...");
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

      console.log("🟢 [Supabase] Login success:", data);

      const session = (data as any)?.session ?? null;
      const accessToken = session?.access_token ?? null;

      console.log("🟣 [Supabase] Access Token:", accessToken?.slice(0, 20), "...");

      // 2) Call your backend /api/auth/me with the access token.
      const apiBase = getApiBase();
      const meUrl = `${apiBase}/api/auth/me`;

      console.log("🟠 [Backend] Calling:", meUrl);
      console.log("🟠 Authorization header:", `Bearer ${accessToken?.slice(0, 12)}...`);

      try {
        const resp = await fetch(meUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        console.log("🟠 [Backend] Status:", resp.status);

        const text = await resp.text();
        console.log("🟠 [Backend] Raw Response:", text);

        let json: any = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch (parseErr) {
          console.error("🔴 [Backend] JSON parse error:", parseErr);
          setMsg(`Invalid server response: ${text}`);
        }

        if (!resp.ok) {
          console.error("🔴 [Backend] Error Response:", json);
          const errMsg = json?.message ?? `Status ${resp.status}`;
          setMsg(`Server error: ${errMsg}`);
        }

        const role: string | undefined = json?.user?.role;
        console.log("🟢 [Backend] Extracted role:", role);

        // Set the role in AuthProvider synchronously BEFORE navigation to avoid races.
        auth.setRole(role ?? null);
        console.log("🟢 [SignIn] auth.setRole called with:", role ?? null);

        // If there was an original intended route, go there first
        const intended = locState?.from?.pathname;
        if (intended) {
          console.log("🟢 Redirecting to intended route:", intended);
          navigate(intended);
          setLoading(false);
          return;
        }

        // Navigate based on role from server response
        if (role === "student") {
          console.log("🟢 Redirecting to /student");
          navigate("/student");
        } else if (role === "teacher") {
          console.log("🟢 Redirecting to /teacher");
          navigate("/teacher");
        } else {
          console.warn("⚠️ No role found. Redirecting to /dashboard");
          navigate("/dashboard");
        }
      } catch (backendErr: any) {
        // Backend request failed (network, CORS, etc.)
        console.error("🔴 [Backend] /api/auth/me request failed:", backendErr);
        setMsg("Signed in locally but failed to contact server for profile. Redirecting to dashboard.");

        // fallback navigation even if backend failed
        const intended = locState?.from?.pathname;
        if (intended) {
          console.log("🟢 Redirecting to intended route (fallback):", intended);
          navigate(intended);
        } else {
          console.log("🟢 Redirecting to /dashboard (fallback)");
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      console.error("🔴 [SignIn] Unexpected error:", err);
      setMsg(err?.message ?? String(err));
    } finally {
      console.log("🟢 [SignIn] Sign-in finished.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSignIn} style={{ maxWidth: 420 }}>
      <h2>Sign in</h2>

      <div>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div>
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </button>

      {msg && <p>{msg}</p>}
    </form>
  );
};

export default SignIn;
