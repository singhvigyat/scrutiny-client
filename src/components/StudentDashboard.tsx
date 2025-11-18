// src/components/StudentDashboard.tsx
import React, { useEffect, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

type QuizMeta = {
  id?: string;
  quizId?: string;
  title?: string;
  subject?: string;
  duration?: number;
  totalQuestions?: number;
  dueDate?: string;
  status?: string; // available | in_progress | completed | missed | draft | active etc.
  attempts?: number;
  maxAttempts?: number;
  assignedTo?: string[] | string;
  studentsAssigned?: number;
  createdBy?: string;
  teacherId?: string;
  email?: string;
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
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const resp = await fetch(`${apiBase}/api/quizzes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      console.log("[StudentDashboard] GET /api/quizzes status:", resp.status);
      const text = await resp.text();
      console.log("[StudentDashboard] GET /api/quizzes raw response:", text);

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.warn("[StudentDashboard] could not parse quizzes response as JSON", parseErr);
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        console.error("[StudentDashboard] fetch quizzes failed:", errMsg);
        setError(String(errMsg));
        setLoading(false);
        return;
      }

      const all: QuizMeta[] = Array.isArray(json) ? json : json?.quizzes ?? json?.data ?? [];
      console.log("[StudentDashboard] fetched quizzes count:", (all || []).length);

      // Try to determine student identifier
      const userId = (auth.user as any)?.id ?? (auth.user as any)?.user?.id ?? null;
      const userEmail = (auth.user as any)?.email ?? (auth.user as any)?.user?.email ?? null;
      console.log("[StudentDashboard] student identifiers:", { userId, userEmail });

      const filtered = (all || []).filter((q) => {
        if (!q) return false;

        const status = (q.status ?? "").toString().toLowerCase();
        const assigned = q.assignedTo ?? q.allowedStudents ?? q.studentIds ?? q.students ?? null;

        // 1) If assigned list exists, check membership
        if (assigned) {
          if (Array.isArray(assigned)) {
            if (userId && assigned.map(String).includes(String(userId))) {
              console.log("[StudentDashboard] included by assigned array:", q.id);
              return true;
            }
            if (userEmail && assigned.map(String).includes(String(userEmail))) {
              console.log("[StudentDashboard] included by assigned email in array:", q.id);
              return true;
            }
          } else if (typeof assigned === "string") {
            const parts = assigned.split?.(",").map((s: string) => s.trim()) ?? [assigned];
            if (userId && parts.includes(String(userId))) {
              console.log("[StudentDashboard] included by assigned csv (id):", q.id);
              return true;
            }
            if (userEmail && parts.includes(String(userEmail))) {
              console.log("[StudentDashboard] included by assigned csv (email):", q.id);
              return true;
            }
          }
          // assigned exists but student not in it -> exclude
          console.log("[StudentDashboard] excluded: assigned list present but student not included:", q.id);
          return false;
        }

        // 2) If status indicates availability, include
        if (status === "available" || status === "active") {
          console.log("[StudentDashboard] included by status:", q.id);
          return true;
        }

        // 3) If creatorId exists and is not the student, assume teacher-created quiz intended for students -> include
        const creator = q.creatorId ?? q.createdBy ?? q.creator_id ?? q.created_by ?? null;
        if (creator && String(creator) !== String(userId)) {
          console.log("[StudentDashboard] included: creator present and not the student:", q.id, "creator:", creator);
          return true;
        }

        // 4) If there is no owner metadata at all, include (public)
        const ownerCandidates = [q.teacherId, q.createdBy, q.creatorId, q.ownerId, q.userId, q.instructorId, q.teacher_id, q.created_by, q.creator_id, q.owner_id];
        const hasOwnerInfo = ownerCandidates.some((c) => c !== undefined && c !== null);
        if (!hasOwnerInfo) {
          console.log("[StudentDashboard] included: no owner metadata (public):", q.id);
          return true;
        }

        // otherwise exclude
        console.log("[StudentDashboard] excluded: no assignment, not available, creator==student or owner info present:", q.id);
        return false;
      });

      console.log("[StudentDashboard] filtered quizzes count:", filtered.length);
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

  // Logout handler
  const handleLogout = async () => {
    console.log("[StudentDashboard] logout requested");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[StudentDashboard] supabase signOut error:", error);
      } else {
        console.log("[StudentDashboard] supabase signOut success");
      }
    } catch (err: any) {
      console.error("[StudentDashboard] signOut threw:", err);
    } finally {
      // Clear role in auth context (persisted role in localStorage will be removed by AuthProvider.setRole)
      try {
        auth.setRole(null);
      } catch (e) {
        console.warn("[StudentDashboard] auth.setRole null failed:", e);
      }
      // Clear local UI state
      setQuizzes([]);
      setError(null);
      setLoading(false);
      // navigate to signin
      navigate("/signin");
    }
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

            <button
              onClick={handleLogout}
              className="px-3 py-1 border rounded text-sm bg-red-50 hover:bg-red-100 text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Available quizzes</h2>
            <div className="text-sm text-gray-500">{loading ? "Loading..." : `${quizzes.length} quizzes`}</div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-600">Loading quizzes...</div>
          ) : error ? (
            <div className="text-sm text-red-600">Error: {error}</div>
          ) : quizzes.length === 0 ? (
            <div className="text-sm text-gray-600">No quizzes available right now.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizzes.map((q, i) => {
                const id = q.id ?? q.quizId ?? q._id ?? `q-${i}`;
                const status = (q.status ?? "available").toString();
                return (
                  <div key={String(id)} className="bg-white border rounded-lg p-4 shadow-sm flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-lg">{q.title ?? "Untitled quiz"}</div>
                        <div className="text-xs text-gray-500">{q.subject ?? "No subject"}</div>
                      </div>
                      <div className="text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            status.includes("avail") ? "bg-green-100 text-green-800 border border-green-200" : status.includes("in_progress") ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-gray-100 text-gray-700 border border-gray-200"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-gray-600 flex-1">
                      <div className="mb-1">Questions: {q.totalQuestions ?? "—"}</div>
                      <div className="mb-1">Duration: {q.duration ? `${q.duration} min` : "—"}</div>
                      <div className="mb-1">Due: {formatDate(q.dueDate)} ({getDaysRemaining(q.dueDate)})</div>
                      <div>Attempts: {q.attempts ?? 0}/{q.maxAttempts ?? "∞"}</div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {/* Students cannot view details — keep Start disabled until you implement the quiz runner */}
                      <button disabled className="bg-sky-600 text-white px-3 py-2 rounded opacity-80 cursor-not-allowed text-sm">
                        Start
                      </button>

                      <button
                        onClick={() => {
                          console.log("[StudentDashboard] Attempt clicked but not implemented", id);
                          // optional: navigate to /quizzes/:id/take
                        }}
                        className="px-3 py-2 border rounded text-sm"
                      >
                        Details (disabled)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
