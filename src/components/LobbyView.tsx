// src/components/LobbyView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSessionPoll } from "../hooks/useSessionPoll";
import { supabase } from "../lib/supabaseClient";

interface Props {
  sessionId: string;
  role: "teacher" | "student";
  onClose?: () => void;
  onSessionStarted?: (session: any) => void;
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

type RawSession = any;

function normalizeSession(raw: RawSession) {
  if (!raw) return null;

  // session id
  const id = raw.id ?? raw.sessionId ?? raw.session_id ?? raw.session?.id ?? null;

  // quiz id
  const quizId =
    raw.quizId ??
    raw.quiz_id ??
    raw.quiz?.id ??
    raw.quiz?.quizId ??
    raw.quiz?.quiz_id ??
    raw.quizId ??
    raw.quiz ??
    null;

  // participants
  const participants = raw.participants ?? raw.users ?? raw.participantList ?? [];

  // status
  const status = (raw.status ?? raw.state ?? "").toString();

  // start/end times
  const startsAt = raw.startsAt ?? raw.startTime ?? raw.start_time ?? raw.starts_at ?? raw.session?.startsAt ?? raw.session?.startTime ?? null;
  const endsAt = raw.endsAt ?? raw.endTime ?? raw.end_time ?? raw.ends_at ?? raw.session?.endsAt ?? raw.session?.endTime ?? null;

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

export default function LobbyView({ sessionId, role, onClose, onSessionStarted }: Props): React.ReactElement {
  const { session, loading, error, setSession } = useSessionPoll(sessionId);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // If the session becomes active, fetch canonical session details (to ensure we have quizId etc)
  useEffect(() => {
    // only react to status === active
    if (!session) return;
    const sStatus = (session.status ?? session.state ?? "").toString().toLowerCase();

    if (sStatus === "active") {
      console.log("[LobbyView] detected active session from poll:", session);

      // Fetch full session details to normalize fields before notifying parent
      (async () => {
        try {
          const sessRes = await supabase.auth.getSession();
          const accessToken = sessRes?.data?.session?.access_token ?? null;
          if (!accessToken) {
            console.warn("[LobbyView] no access token when fetching session details");
            // still pass normalized poll session if nothing else
            const normalized = normalizeSession(session);
            onSessionStarted?.(normalized);
            return;
          }

          const resp = await fetch(`${apiBase}/api/sessions/${encodeURIComponent(sessionId)}`, {
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
            console.warn("[LobbyView] could not parse session GET response:", parseErr, "raw:", text);
            json = null;
          }

          if (!resp.ok) {
            console.warn("[LobbyView] GET /api/sessions/:id returned non-OK:", resp.status, text);
            // fallback to poll-provided session, normalized
            const normalized = normalizeSession(session);
            onSessionStarted?.(normalized);
            return;
          }

          const full = json?.session ?? json ?? session;
          const normalized = normalizeSession(full);
          console.log("[LobbyView] fetched full session details (normalized):", normalized);
          onSessionStarted?.(normalized);
        } catch (err: any) {
          console.error("[LobbyView] error fetching full session details:", err);
          // fallback: pass normalized poll session
          const normalized = normalizeSession(session);
          onSessionStarted?.(normalized);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

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
      const resp = await fetch(`${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      const text = await resp.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
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
      const resp = await fetch(`${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/end`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      const text = await resp.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
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
            participants.map((p, i) => (
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
