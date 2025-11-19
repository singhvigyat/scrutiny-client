// src/components/StudentDashboard.tsx
import React, { useEffect, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import EnterPinModal from "./EnterPinModal";
import LobbyView from "./LobbyView";
import StudentQuizView from "./StudentQuizView";

type QuizMeta = {
  id?: string;
  quizId?: string;
  title?: string;
  subject?: string;
  duration?: number;
  totalQuestions?: number;
  dueDate?: string;
  status?: string;
  attempts?: number;
  maxAttempts?: number;
  assignedTo?: string[] | string;
  studentsAssigned?: number;
  createdBy?: string;
  teacherId?: string;
  email?: string;
  // fields returned by history endpoint:
  submissionId?: string;
  score?: number;
  submittedAt?: string;
  [k: string]: any;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateString;
  }
};

const getDaysRemaining = (dueDate?: string) => {
  if (!dueDate) return "No due date";
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `${diffDays} days left`;
};

export default function StudentDashboard(): React.ReactElement {
  const auth = useAuthContext();
  const [quizzes, setQuizzes] = useState<QuizMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pin / lobby states
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // IMPORTANT: quizId returned by join — authoritative for this student
  const [joinedQuizId, setJoinedQuizId] = useState<string | null>(null);

  // When session becomes active we will fetch quiz into this
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

  const fetchQuizzes = async () => {
    console.log("[StudentDashboard] fetchQuizzes start");
    setError(null);
    setLoading(true);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      console.log("[StudentDashboard] token present:", Boolean(accessToken));
      if (!accessToken) {
        setError("No access token available. Please sign in.");
        setLoading(false);
        return;
      }

      // NOTE: history endpoint (returns past submissions for this student)
      const resp = await fetch(`${apiBase}/api/quizzes/history`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      console.log("[StudentDashboard] GET /api/quizzes/history status:", resp.status);
      const text = await resp.text();
      console.log("[StudentDashboard] GET /api/quizzes/history raw response:", text);

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.warn("[StudentDashboard] could not parse quizzes history response as JSON", parseErr);
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        console.error("[StudentDashboard] fetch quizzes history failed:", errMsg);
        setError(String(errMsg));
        setLoading(false);
        return;
      }

      // The history endpoint returns an array of submissions
      const all: QuizMeta[] = Array.isArray(json) ? json : json?.history ?? json?.data ?? [];
      console.log("[StudentDashboard] fetched quizzes (history) count:", (all || []).length);

      // We keep the same filter logic but for history we generally show everything returned.
      // For robustness we still run a light filter to remove nulls.
      const filtered = (all || []).filter(Boolean);
      console.log("[StudentDashboard] filtered quizzes (history) count:", filtered.length);
      setQuizzes(filtered);
    } catch (err: any) {
      console.error("[StudentDashboard] fetchQuizzes error:", err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
      console.log("[StudentDashboard] fetchQuizzes finished");
    }
  };

  useEffect(() => {
    fetchQuizzes().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when EnterPinModal notifies a successful join
  const handlePinJoined = (sessionId: string, quizId?: string | null) => {
    console.log("[StudentDashboard] onPinJoined sessionId=", sessionId, "quizId=", quizId);
    setCurrentSessionId(String(sessionId));
    if (quizId) setJoinedQuizId(String(quizId));
    // leave EnterPinModal open state to parent UI decides; here we just store ids
    setPinModalOpen(false);
  };

  // called by LobbyView when session status becomes active (normalized)
  const handleSessionStarted = async (sessionNormalized: any) => {
    console.log("[StudentDashboard] onSessionStarted", sessionNormalized);

    // prefer quizId from the join response (joinedQuizId) — that is authoritative for this student
    const quizIdToUse = joinedQuizId ?? sessionNormalized?.quizId ?? sessionNormalized?.session?.quizId ?? null;

    if (!quizIdToUse) {
      console.warn("[StudentDashboard] No quizId available from join or session; cannot fetch quiz yet.", { sessionNormalized, joinedQuizId });
      setError("Quiz details not available yet — please wait for teacher.");
      return;
    }

    console.log("[StudentDashboard] Using quizId to fetch quiz:", quizIdToUse);

    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        console.warn("[StudentDashboard] no access token when trying to fetch quiz");
        setError("No auth token available.");
        return;
      }

      const resp = await fetch(`${apiBase}/api/quizzes/${encodeURIComponent(quizIdToUse)}`, {
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
      } catch {
        console.warn("[StudentDashboard] quiz GET returned non-JSON:", text.slice(0, 200));
      }

      if (!resp.ok) {
        console.error("[StudentDashboard] failed to fetch quiz:", resp.status, text);
        setError("Failed to load quiz details. Please contact your teacher.");
        return;
      }

      console.log("[StudentDashboard] fetched quiz details:", json);
      setActiveQuiz(json);
    } catch (err: any) {
      console.error("[StudentDashboard] error fetching quiz:", err);
      setError("Network or server error while loading quiz.");
    }
  };

  // handle session updates (optional) — e.g. show lobby info
  const handleSessionUpdate = (normalized: any) => {
    console.log("[StudentDashboard] lobby update:", normalized);
    // could update UI about participants, time left, etc.
  };

  const logout = async () => {
    const { supabase: sb } = { supabase }; // to keep linter happy
    await sb.auth.signOut();
    // optionally redirect; parent router may detect no-auth and show sign-in
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Scrutiny</h1>
            <div className="text-xs text-gray-500">Student dashboard</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Signed in as: {auth.user?.email ?? "—"}</div>
            <button
              onClick={() => {
                console.log("[StudentDashboard] Refresh clicked");
                fetchQuizzes();
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              Refresh
            </button>

            <button onClick={logout} className="px-3 py-1 border rounded text-sm bg-red-50 text-red-700 hover:bg-red-100">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Title updated to reflect history */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">My Quiz History</h2>
            <div className="text-sm text-gray-500">{loading ? "Loading..." : `${quizzes.length} records`}</div>
          </div>

          <div className="mb-6 flex gap-3">
            <button onClick={() => setPinModalOpen(true)} className="px-3 py-2 bg-sky-600 text-white rounded">
              Enter PIN to Join Lobby
            </button>

            {currentSessionId && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                In lobby: <strong>{currentSessionId}</strong>
              </div>
            )}
          </div>

          {/* if activeQuiz present, show quiz view; otherwise show history list + optional lobby view */}
          {activeQuiz ? (
            <StudentQuizView 
              quiz={activeQuiz} 
              sessionId={currentSessionId} 
              onComplete={() => {
                console.log("[StudentDashboard] Quiz completed, returning to dashboard");
                setActiveQuiz(null);
                fetchQuizzes();
              }}
            />
          ) : (
            <>
              {/* Lobby view (if joined) */}
              {currentSessionId && (
                <div className="mb-6">
                  <LobbyView
                    sessionId={currentSessionId}
                    role="student"
                    onSessionStarted={handleSessionStarted}
                    onSessionUpdate={handleSessionUpdate}
                  />
                </div>
              )}

              {loading ? (
                <div className="text-sm text-gray-600">Loading history...</div>
              ) : error ? (
                <div className="text-sm text-red-600">Error: {error}</div>
              ) : quizzes.length === 0 ? (
                <div className="text-sm text-gray-600">No quiz history available yet.</div>
              ) : (
                // Render history rows
                <div className="space-y-4">
                  {quizzes.map((q, i) => {
                    const id = q.submissionId ?? q.quizId ?? q.id ?? `h-${i}`;
                    return (
                      <div key={String(id)} className="bg-white border rounded-lg p-4 shadow-sm flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="font-medium text-lg">{q.title ?? "Untitled quiz"}</div>
                              <div className="text-xs text-gray-500">{q.subject ?? "No subject"}</div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-gray-500">Score</div>
                              <div className="font-semibold text-lg">
                                {typeof q.score === "number" ? `${q.score}` : (q.score ?? "—")}
                                <span className="text-xs text-gray-500">/{q.totalQuestions ?? "—"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 text-xs text-gray-500">
                            Submitted: {q.submittedAt ? formatDate(q.submittedAt) : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Enter PIN modal */}
      <EnterPinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onJoined={(sessionId, quizId) => {
          handlePinJoined(sessionId, quizId ?? null);
        }}
      />
    </div>
  );
}
