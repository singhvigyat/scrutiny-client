// src/components/LobbyView.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useSessionPoll } from "../hooks/useSessionPoll";
import { supabase } from "../lib/supabaseClient";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Users, Play, Square, Clock, Hash, Info } from "lucide-react";

interface Props {
  sessionId: string;
  role: "teacher" | "student";
  onClose?: () => void;
  onSessionStarted?: (session: any) => void;
  onSessionUpdate?: (session: any) => void;
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

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

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

            const full = json?.session ?? json ?? session;
            const normalized = normalizeSession(full);
            console.log("[LobbyView] fetched session via /status (normalized):", normalized);
            onSessionStarted?.(normalized);
            return;
          } catch (err) {
            console.warn("[LobbyView] status endpoint failed or missing, falling back. err:", err);
          }

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
    <Card className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Hash className="w-4 h-4" />
            Session ID
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{session?.id ?? sessionId}</div>
          {session?.pin && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
              PIN: {session.pin}
            </div>
          )}
        </div>

        <div className="text-right space-y-1">
          <div className="flex items-center justify-end gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Info className="w-4 h-4" />
            Status
          </div>
          <div className={`font-medium px-3 py-1 rounded-full inline-block text-sm ${
            session?.status === "active" 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}>
            {session?.status ?? "unknown"}
          </div>
          {session?.startsAt && (
            <div className="flex items-center justify-end gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {new Date(session.startsAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-sm">{error}</div>}
      {actionError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded text-sm">{actionError}</div>}

      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white mb-3">
          <Users className="w-4 h-4" />
          Participants ({participants.length})
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4 min-h-[100px] max-h-[300px] overflow-y-auto">
          {participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-4">
              <Users className="w-8 h-8 mb-2 opacity-20" />
              Waiting for students to join...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {participants.map((p: any, i: any) => (
                <div key={p.id ?? i} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                  <div className="truncate">
                    <div className="font-medium text-sm text-slate-900 dark:text-white truncate">{p.name ?? p.email ?? p.id}</div>
                    {p.email && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
        {role === "teacher" && (
          <>
            <Button 
              onClick={startSession} 
              disabled={actionLoading || session?.status === "active"} 
              variant="primary"
              loading={actionLoading}
              icon={<Play className="w-4 h-4" />}
            >
              {session?.status === "active" ? "Session Active" : "Start Session"}
            </Button>
            
            <Button 
              onClick={endSession} 
              disabled={actionLoading || session?.status !== "active"} 
              variant="danger"
              icon={<Square className="w-4 h-4" />}
            >
              End Session
            </Button>
          </>
        )}

        <Button onClick={() => onClose?.()} variant="outline">
          Close Lobby
        </Button>
      </div>
    </Card>
  );
}
