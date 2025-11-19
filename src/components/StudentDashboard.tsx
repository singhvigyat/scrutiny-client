// src/components/StudentDashboard.tsx
import React, { useEffect, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { LogOut, RefreshCw, Key, Clock, CheckCircle, AlertCircle } from "lucide-react";

import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { ThemeToggle } from "./ThemeToggle";
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

  // Track submitted sessions/quizzes to prevent re-opening via poll
  const submittedRef = React.useRef<Set<string>>(new Set());

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("submittedItems");
      if (saved) {
        submittedRef.current = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load submitted items", e);
    }
  }, []);

  const markSubmitted = (sId?: string | null, qId?: string | null) => {
    if (sId) submittedRef.current.add(`s:${sId}`);
    if (qId) submittedRef.current.add(`q:${qId}`);
    try {
      localStorage.setItem("submittedItems", JSON.stringify(Array.from(submittedRef.current)));
    } catch (e) {
      console.warn("Failed to save submitted items", e);
    }
  };

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

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.warn("[StudentDashboard] could not parse quizzes history response as JSON", parseErr);
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        setError(String(errMsg));
        setLoading(false);
        return;
      }

      const all: QuizMeta[] = Array.isArray(json) ? json : json?.history ?? json?.data ?? [];
      const filtered = (all || []).filter(Boolean);
      setQuizzes(filtered);
    } catch (err: any) {
      console.error("[StudentDashboard] fetchQuizzes error:", err);
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
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
    setPinModalOpen(false);
  };

  // called by LobbyView when session status becomes active (normalized)
  const handleSessionStarted = async (sessionNormalized: any) => {
    console.log("[StudentDashboard] onSessionStarted", sessionNormalized);

    const quizIdToUse = joinedQuizId ?? sessionNormalized?.quizId ?? sessionNormalized?.session?.quizId ?? null;
    const sId = sessionNormalized?.id ?? sessionNormalized?.sessionId;

    // Check if we should ignore this start event
    if (sId) {
      const key = `s:${sId}`;
      if (submittedRef.current.has(key)) {
        console.log("[StudentDashboard] Ignoring session start for already submitted session:", key);
        return;
      }
    }
    if (quizIdToUse) {
      const key = `q:${quizIdToUse}`;
      if (submittedRef.current.has(key)) {
        console.log("[StudentDashboard] Ignoring session start for already submitted quiz:", key);
        return;
      }
    }

    if (!quizIdToUse) {
      setError("Quiz details not available yet — please wait for teacher.");
      return;
    }

    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
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
        // ignore
      }

      if (!resp.ok) {
        setError("Failed to load quiz details. Please contact your teacher.");
        return;
      }

      setActiveQuiz(json);
    } catch (err: any) {
      console.error("[StudentDashboard] error fetching quiz:", err);
      setError("Network or server error while loading quiz.");
    }
  };

  const handleSessionUpdate = (normalized: any) => {
    console.log("[StudentDashboard] lobby update:", normalized);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 sticky top-0 z-10 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Scrutiny</h1>
            <div className="text-xs text-slate-500 dark:text-slate-400">Student Dashboard</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-300 hidden md:block">
              {auth.user?.email ?? "—"}
            </div>
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              icon={<LogOut className="w-4 h-4" />}
            >
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Active Quiz View */}
          {activeQuiz ? (
            <StudentQuizView 
              quiz={activeQuiz} 
              sessionId={currentSessionId} 
              onComplete={(completedQuizId) => {
                console.log("[StudentDashboard] Quiz completed, returning to dashboard. qId:", completedQuizId);
                markSubmitted(currentSessionId, completedQuizId);
                setActiveQuiz(null);
                fetchQuizzes();
              }}
            />
          ) : (
            <>
              {/* Lobby View (if joined) */}
              {currentSessionId && (
                <Card className="mb-8 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Waiting Room
                    </h3>
                    <span className="text-sm font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                      Session: {currentSessionId}
                    </span>
                  </div>
                  <LobbyView
                    sessionId={currentSessionId}
                    role="student"
                    onSessionStarted={handleSessionStarted}
                    onSessionUpdate={handleSessionUpdate}
                  />
                </Card>
              )}

              {/* Actions & History Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">My Quiz History</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {loading ? "Loading records..." : `${quizzes.length} past submissions`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    variant="primary" 
                    onClick={() => setPinModalOpen(true)}
                    icon={<Key className="w-4 h-4" />}
                  >
                    Enter PIN to Join
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => fetchQuizzes()}
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}

              {/* History List */}
              {!loading && quizzes.length === 0 && !error ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 mb-4">
                    <Clock className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">No history yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                    You haven't taken any quizzes yet. Join a session with a PIN to get started.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {quizzes.map((q, i) => {
                    const id = q.submissionId ?? q.quizId ?? q.id ?? `h-${i}`;
                    return (
                      <Card key={String(id)} className="hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                                  {q.title ?? "Untitled Quiz"}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  {q.subject ?? "No subject"}
                                </p>
                              </div>

                              <div className="text-right">
                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Score</div>
                                <div className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">
                                  {typeof q.score === "number" ? `${q.score}` : (q.score ?? "—")}
                                  <span className="text-sm text-slate-400 font-normal ml-1">
                                    / {q.totalQuestions ?? "—"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              Submitted on {q.submittedAt ? formatDate(q.submittedAt) : "—"}
                            </div>
                          </div>
                        </div>
                      </Card>
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
