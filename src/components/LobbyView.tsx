// src/components/LobbyView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSessionPoll } from "../hooks/useSessionPoll";
import { supabase } from "../lib/supabaseClient";

interface Props {
  sessionId: string;
  role: "teacher" | "student";
  onClose?: () => void;
  onSessionStarted?: (session: any) => void;
  onSessionUpdate?: (session: any) => void; // NEW: optional callback for interim session updates
}

type RawSession = any;

function normalizeSession(raw: RawSession) {
  if (!raw) return null;

  const id = raw.id ?? raw.sessionId ?? raw.session_id ?? raw.session?.id ?? null;

  const quizId =
    raw.quizId ??
    raw.quiz_id ??
    raw.quiz?.id ??
    raw.quiz?.quizId ??
    raw.quiz?.quiz_id ??
    raw.quiz ??
    raw.session?.quizId ??
    raw.session?.quiz_id ??
    null;

  const participants = raw.participants ?? raw.users ?? raw.participantList ?? [];

  const status = (raw.status ?? raw.state ?? "").toString();

  const startsAt =
    raw.startsAt ??
    raw.startTime ??
    raw.start_time ??
    raw.starts_at ??
    raw.session?.startsAt ??
    raw.session?.startTime ??
    null;
  const endsAt =
    raw.endsAt ??
    raw.endTime ??
    raw.end_time ??
    raw.ends_at ??
    raw.session?.endsAt ??
    raw.session?.endTime ??
    null;

  const pin = raw.pin ?? raw.pinCode ?? raw.code ?? raw.session?.pin ?? null;

  return {
    ...raw,
    id,
    quizId,
    participants,
    status,
    startsAt,
    endsAt,
    pin,
  };
}

export default function LobbyView({
  sessionId,
  role,
  onClose,
  onSessionStarted,
  onSessionUpdate,
}: Props): React.ReactElement {
  const { session, loading, error, setSession } = useSessionPoll(sessionId);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // derive apiBase as other components do
  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

  // Notify parent about any session updates coming from poll (normalized)
  useEffect(() => {
    if (!session) return;
    const normalized = normalizeSession(session);
    try {
      if (normalized) {
        onSessionUpdate?.(normalized);
      }
    } catch (err) {
      console.warn("[LobbyView] onSessionUpdate threw", err);
    }
  }, [session, onSessionUpdate]);

  // If the session becomes active, fetch canonical session details (try status endpoint first)
  useEffect(() => {
    if (!session) return;
    const sStatus = (session.status ?? session.state ?? "").toString().toLowerCase();

    if (sStatus === "active") {
      console.log("[LobbyView] detected active session from poll:", session);

      (async () => {
        try {
          const sessRes = await supabase.auth.getSession();
          const accessToken = sessRes?.data?.session?.access_token ?? null;
          if (!accessToken) {
            console.warn("[LobbyView] no access token when fetching session details - falling back to poll session");
            const normalized = normalizeSession(session);
            onSessionStarted?.(normalized);
            return;
          }

          // Try the new /status endpoint first
          const statusUrl = `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/status`;
          console.log("[LobbyView] fetching full session details from (status endpoint):", statusUrl);

          try {
            const resp = await fetch(statusUrl, {
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
              console.warn("[LobbyView] could not parse status GET response:", parseErr, "raw:", text);
              json = null;
            }

            if (!resp.ok) {
              console.warn("[LobbyView] GET /status returned non-OK:", resp.status, text);
              throw new Error(`status endpoint returned ${resp.status}`);
            }

            // On success, prefer json.session or json
            const full = json?.session ?? json ?? session;
            const normalized = normalizeSession(full);
            console.log("[LobbyView] fetched session via /status (normalized):", normalized);
            onSessionStarted?.(normalized);
            return;
          } catch (err) {
            console.warn("[LobbyView] status endpoint failed or missing, falling back. err:", err);
            // fallthrough to canonical fallbacks below
          }

          // fallback: try canonical session endpoints (same pattern as useSessionPoll)
          const fallbacks = [
            `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}`,
            `${apiBase}/api/session/${encodeURIComponent(sessionId)}`,
            `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/detail`,
            `${apiBase}/sessions/${encodeURIComponent(sessionId)}`,
            `/api/sessions/${encodeURIComponent(sessionId)}`,
          ];

          for (const url of fallbacks) {
            try {
              console.log("[LobbyView] fallback fetching session from:", url);
              const r = await fetch(url, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                  "ngrok-skip-browser-warning": "true",
                },
              });
              const t = await r.text();
              let j: any = null;
              try {
                j = t ? JSON.parse(t) : null;
              } catch {
                j = null;
              }
              if (!r.ok) {
                console.warn("[LobbyView] fallback returned non-ok:", r.status, t);
                continue;
              }
              const full = j?.session ?? j ?? session;
              const normalized = normalizeSession(full);
              console.log("[LobbyView] fetched session via fallback (normalized):", normalized);
              onSessionStarted?.(normalized);
              return;
            } catch (innerErr) {
              console.warn("[LobbyView] fallback fetch failed for", url, innerErr);
              continue;
            }
          }

          // nothing succeeded — pass normalized poll session
          const normalized = normalizeSession(session);
          console.warn("[LobbyView] could not fetch canonical session details, passing normalized poll session:", normalized);
          onSessionStarted?.(normalized);
        } catch (err: any) {
          console.error("[LobbyView] error fetching full session details:", err);
          const normalized = normalizeSession(session);
          onSessionStarted?.(normalized);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, apiBase]);

  const participants = useMemo(() => session?.participants ?? [], [session]);

  const startSession = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        setActionError("No access token.");
        setActionLoading(false);
        return;
      }

      const url = `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/start`;
      console.log("[LobbyView] POST start session ->", url);

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!resp.ok) {
        setActionError(json?.message ?? text ?? `Status ${resp.status}`);
        setActionLoading(false);
        return;
      }

      // update local session; polling will catch up too
      setSession(json ?? session);
      console.log("[LobbyView] started session:", json);
    } catch (err: any) {
      console.error("[LobbyView] start error:", err);
      setActionError(String(err?.message ?? err));
    } finally {
      setActionLoading(false);
    }
  };

  const endSession = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        setActionError("No access token.");
        setActionLoading(false);
        return;
      }

      const url = `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/end`;
      console.log("[LobbyView] POST end session ->", url);

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!resp.ok) {
        setActionError(json?.message ?? text ?? `Status ${resp.status}`);
        setActionLoading(false);
        return;
      }

      setSession(json ?? session);
      console.log("[LobbyView] ended session:", json);
    } catch (err: any) {
      console.error("[LobbyView] end error:", err);
      setActionError(String(err?.message ?? err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white border rounded p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-gray-600">Session</div>
          <div className="text-lg font-semibold">{session?.id ?? sessionId}</div>
          <div className="text-xs text-gray-500">{session?.pin ? `PIN: ${session.pin}` : ""}</div>
        </div>

        <div className="text-right">
          <div className="text-sm">Status</div>
          <div className="font-medium">{session?.status ?? "unknown"}</div>
          <div className="text-xs text-gray-500">{session?.startsAt ? `Starts: ${new Date(session.startsAt).toLocaleString()}` : ""}</div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {actionError && <div className="text-sm text-red-600">{actionError}</div>}

      <div className="mb-3">
        <div className="text-sm font-medium mb-2">Participants ({participants.length})</div>
        <div className="space-y-2">
          {participants.length === 0 ? (
            <div className="text-sm text-gray-500">No participants yet</div>
          ) : (
            participants.map((p: any, i: any) => (
              <div key={p.id ?? i} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name ?? p.email ?? p.id}</div>
                  <div className="text-xs text-gray-500">{p.email ?? ""}</div>
                </div>
                <div className="text-xs text-gray-500">{p.id}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {role === "teacher" && (
          <>
            <button onClick={startSession} disabled={actionLoading || session?.status === "active"} className="px-3 py-1 bg-green-600 text-white rounded">
              {actionLoading ? "Working..." : session?.status === "active" ? "Active" : "Start"}
            </button>
            <button onClick={endSession} disabled={actionLoading || session?.status !== "active"} className="px-3 py-1 border rounded">
              End
            </button>
          </>
        )}

        <button onClick={() => onClose?.()} className="px-3 py-1 border rounded">
          Close Lobby
        </button>
      </div>
    </div>
  );
}
