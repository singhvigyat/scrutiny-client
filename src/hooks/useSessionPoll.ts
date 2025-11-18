// src/hooks/useSessionPoll.ts
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Polls session status for a given sessionId.
 *
 * Returns { session, loading, error, setSession }.
 *
 * Implementation notes:
 * - Tries GET /api/sessions/:id/status first (backend now exposes it).
 * - Falls back to a few canonical endpoints if status endpoint missing.
 * - Attaches Authorization header from supabase session.
 * - Exports both named and default for compatibility.
 */

type RawSession = any;

export function useSessionPoll(sessionId: string | null, pollIntervalMs = 2000) {
  const [session, setSession] = useState<RawSession | null>(null);
  const [loading, setLoading] = useState<boolean>(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  const stopped = useRef(false);
  const lastEtag = useRef<string | null>(null); // optional: could store ETag or last raw payload to avoid repeats

  useEffect(() => {
    stopped.current = false;
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      setError(null);
      return;
    }

    const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
    const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

    let abort = false;

    const tryFetchOnce = async () => {
      setLoading(true);
      setError(null);

      // Get token if available
      let accessToken: string | null = null;
      try {
        const sessRes = await supabase.auth.getSession();
        accessToken = sessRes?.data?.session?.access_token ?? null;
      } catch (e) {
        // ignore
        accessToken = null;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const candidates = [
        `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/status`, // preferred
        // `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}`,
        // `${apiBase}/api/session/${encodeURIComponent(sessionId)}`,
        // `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}`, // repeat safe
        // `/api/sessions/${encodeURIComponent(sessionId)}`,
      ];

      let got: any = null;
      let lastError: any = null;

      for (const url of candidates) {
        if (abort) break;
        try {
          // console.debug("[useSessionPoll] trying", url);
          const resp = await fetch(url, { method: "GET", headers });
          const text = await resp.text();

          // If HTML or Vite error page, ignore and try next
          if (text && text.trim().startsWith("<")) {
            // Not JSON — probably 404 HTML or index page served
            lastError = { url, status: resp.status, raw: text };
            // only treat non-200 as try next; if 200 but HTML, still try next
            if (!resp.ok) {
              continue;
            } else {
              // 200 + HTML — treat as missing endpoint
              continue;
            }
          }

          let json: any = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch (parseErr) {
            // fallback: if resp.ok and no JSON, still continue to next candidate
            lastError = { url, status: resp.status, parseErr };
            if (!resp.ok) continue;
            // else continue to next
            continue;
          }

          if (!resp.ok) {
            lastError = { url, status: resp.status, payload: json ?? text };
            continue;
          }

          // success
          got = json ?? null;
          break;
        } catch (fetchErr) {
          lastError = fetchErr;
          continue;
        }
      }

      if (abort) return;

      if (got === null) {
        // nothing retrieved successfully
        setError(lastError ? String(lastError?.status ?? lastError) : "No session info");
        setLoading(false);
        return;
      }

      // Normalise shape: prefer payload.session or payload directly.
      // Many backends return { message, session: {...} } or the session direct.
      const payload = got.session ?? got;
      setSession(payload);
      setLoading(false);
    };

    // initial immediate fetch
    tryFetchOnce().catch((e) => {
      console.error("[useSessionPoll] initial fetch error:", e);
      setError(String(e?.message ?? e));
      setLoading(false);
    });

    // polling loop
    const id = setInterval(() => {
      if (stopped.current || abort) return;
      tryFetchOnce().catch((e) => {
        // avoid noisy repeated logs but keep a console.warn
        console.warn("[useSessionPoll] poll error:", e);
      });
    }, pollIntervalMs);

    return () => {
      abort = true;
      stopped.current = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pollIntervalMs]);

  return { session, loading, error, setSession };
}

export default useSessionPoll;
