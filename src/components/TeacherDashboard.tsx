// src/components/TeacherDashboard.tsx
import React, { useEffect, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Eye, Play, BarChart2, LogOut, RefreshCw } from "lucide-react";

import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";
import { ThemeToggle } from "./ThemeToggle";

import CreateLobbyModal from "./CreateLobbyModal";
import LobbyView from "./LobbyView";

type Option = string;
type Question = {
  questionText: string;
  options: Option[];
  correctAnswer: number; // index
};

type QuizMeta = {
  id?: string;
  title?: string;
  subject?: string;
  createdAt?: string;
  teacherId?: string;
  createdBy?: string;
  [k: string]: any;
};

type QuizFull = {
  id?: string;
  title?: string;
  subject?: string;
  questions?: Array<{
    questionText: string;
    options: string[];
    correctAnswer: number;
  }>;
  [k: string]: any;
};

const emptyQuestion = (): Question => ({
  questionText: "",
  options: ["", ""],
  correctAnswer: 0,
});

export const TeacherDashboard: React.FC = () => {
  // Create quiz states
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  // Quizzes list states
  const [quizzes, setQuizzes] = useState<QuizMeta[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Modal states for viewing a quiz
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalQuiz, setModalQuiz] = useState<QuizFull | null>(null);

  // Lobby / Create lobby states
  const [createLobbyModalOpen, setCreateLobbyModalOpen] = useState(false);
  const [createLobbyQuizId, setCreateLobbyQuizId] = useState<string | null>(null);
  const [lobbySessionId, setLobbySessionId] = useState<string | null>(null);
  const [lobbyPin, setLobbyPin] = useState<string | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);

  // Results modal states
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<any | null>(null);

  const auth = useAuthContext();
  const navigate = useNavigate();

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

  // --- helpers for create quiz ---
  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const setQuestionText = (idx: number, text: string) => {
    updateQuestion(idx, { questionText: text });
  };

  const addOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: [...q.options, ""],
            }
          : q
      )
    );
  };

  const removeOption = (qIdx: number, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = q.options.filter((_, oi) => oi !== optIdx);
        if (newOpts.length < 2) {
          return q;
        }
        let newCorrect = q.correctAnswer;
        if (optIdx < q.correctAnswer) newCorrect = q.correctAnswer - 1;
        if (newCorrect >= newOpts.length) newCorrect = newOpts.length - 1;
        return { ...q, options: newOpts, correctAnswer: newCorrect };
      })
    );
  };

  const setOptionText = (qIdx: number, optIdx: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, oi) => (oi === optIdx ? text : o)) } : q
      )
    );
  };

  const setCorrectAnswer = (qIdx: number, index: number) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, correctAnswer: index } : q)));
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx) || [emptyQuestion()]);
  };

  const validate = (): { ok: boolean; error?: string } => {
    if (!title.trim()) return { ok: false, error: "Title is required." };
    if (!subject.trim()) return { ok: false, error: "Subject is required." };
    if (!questions.length) return { ok: false, error: "Add at least one question." };

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return { ok: false, error: `Question ${i + 1} text is required.` };
      if (!Array.isArray(q.options) || q.options.length < 2) return { ok: false, error: `Question ${i + 1} must have at least 2 options.` };
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) return { ok: false, error: `Question ${i + 1} option ${j + 1} cannot be empty.` };
      }
      if (q.correctAnswer == null || q.correctAnswer < 0 || q.correctAnswer >= q.options.length)
        return { ok: false, error: `Question ${i + 1} has an invalid correct answer index.` };
    }

    return { ok: true };
  };

  // --- fetch list of quizzes ---
  const fetchQuizzesForTeacher = async () => {
    setListError(null);
    setListLoading(true);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      if (!accessToken) {
        setListError("No access token available. Please sign in.");
        setListLoading(false);
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

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        setListError(errMsg);
        setListLoading(false);
        return;
      }

      const all: QuizMeta[] = Array.isArray(json) ? json : json?.quizzes ?? json?.data ?? [];
      const userId = (auth.user as any)?.id ?? (auth.user as any)?.user?.id ?? null;
      const userEmail = (auth.user as any)?.email ?? (auth.user as any)?.user?.email ?? null;

      const filtered = (all || []).filter((q) => {
        if (!q) return false;
        const ownerCandidates = [q.teacherId, q.createdBy, q.creatorId, q.ownerId, q.userId, q.instructorId, q.teacher_id, q.created_by, q.creator_id, q.owner_id];
        for (const cand of ownerCandidates) {
          if (!cand) continue;
          if (String(cand) === String(userId) || String(cand) === String(userEmail)) return true;
        }
        if (q.email && String(q.email) === String(userEmail)) return true;
        return false;
      });

      setQuizzes(filtered);
    } catch (err: any) {
      setListError(String(err?.message ?? err));
    } finally {
      setListLoading(false);
    }
  };

  // --- create quiz handler ---
  const onCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMsg(null);
    setSuccessId(null);

    const v = validate();
    if (!v.ok) {
      setMsg(v.error ?? "Validation failed.");
      return;
    }

    setLoading(true);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      if (!accessToken) {
        setMsg("No access token available. Please sign in again.");
        setLoading(false);
        return;
      }

      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        questions: questions.map((q) => ({
          questionText: q.questionText.trim(),
          options: q.options.map((o) => o.trim()),
          correctAnswer: q.correctAnswer,
        })),
      };

      const resp = await fetch(`${apiBase}/api/quizzes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(payload),
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        setMsg(`Create failed: ${errMsg}`);
        setLoading(false);
        return;
      }

      setMsg("Quiz created successfully.");
      const createdId = json?.id ?? json?.quizId ?? json?.quiz?.id ?? null;
      if (createdId) {
        setSuccessId(String(createdId));
      }

      setTitle("");
      setSubject("");
      setQuestions([emptyQuestion()]);

      // refresh list after creation
      await fetchQuizzesForTeacher();
    } catch (err: any) {
      setMsg("Network or server error: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  };

  // --- delete quiz handler (NEW) ---
  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Are you sure you want to delete this quiz? This action cannot be undone.")) return;

    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        alert("No access token available.");
        return;
      }

      const resp = await fetch(`${apiBase}/api/quizzes/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        alert(`Failed to delete: ${text}`);
        return;
      }

      // refresh list
      await fetchQuizzesForTeacher();
    } catch (err: any) {
      alert(`Error deleting quiz: ${err.message}`);
    }
  };

  // --- fetch single quiz details for modal ---
  const fetchQuizDetails = async (id: string) => {
    setModalError(null);
    setModalLoading(true);
    setModalQuiz(null);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      if (!accessToken) {
        setModalError("No access token available. Please sign in.");
        setModalLoading(false);
        return;
      }

      const resp = await fetch(`${apiBase}/api/quizzes/${encodeURIComponent(id)}`, {
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
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        setModalError(errMsg);
        setModalLoading(false);
        return;
      }

      const quiz: QuizFull = json?.quiz ?? json ?? null;
      setModalQuiz(quiz);
    } catch (err: any) {
      setModalError(String(err?.message ?? err));
    } finally {
      setModalLoading(false);
    }
  };

  const openViewModal = async (id: string) => {
    setViewingId(id);
    setModalOpen(true);
    await fetchQuizDetails(id);
  };

  const closeModal = () => {
    setModalOpen(false);
    setViewingId(null);
    setModalQuiz(null);
    setModalError(null);
    setModalLoading(false);
  };

  // logout handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: any) {
      console.error("signOut threw:", err);
    } finally {
      try { auth.setRole(null); } catch (e) { console.warn("auth.setRole null failed:", e); }
      setQuizzes([]);
      setMsg(null);
      setSuccessId(null);
    }
  };

  // open Create Lobby modal for a quiz
  const openCreateLobbyForQuiz = (quizId: string) => {
    setCreateLobbyQuizId(quizId);
    setCreateLobbyModalOpen(true);
  };

  // called when CreateLobbyModal returns sessionId + pin
  const onLobbyCreated = (sessionId: string, pin: string) => {
    setCreateLobbyModalOpen(false);
    setLobbySessionId(sessionId);
    setLobbyPin(pin);
    setLobbyOpen(true);
  };

  // close lobby view
  const closeLobbyView = () => {
    setLobbyOpen(false);
    setLobbySessionId(null);
    setLobbyPin(null);
  };

  // --- fetch results for a quiz ---
  const fetchResultsForQuiz = async (quizId: string) => {
    setResultsError(null);
    setResultsData(null);
    setResultsLoading(true);
    setResultsModalOpen(true);

    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        setResultsError("No access token. Please sign in.");
        setResultsLoading(false);
        return;
      }

      const url = `${apiBase}/api/quizzes/${encodeURIComponent(quizId)}/results`;
      const resp = await fetch(url, {
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
        json = null;
      }

      if (!resp.ok) {
        const errMsg = json?.error ?? json?.message ?? text ?? `Status ${resp.status}`;
        setResultsError(String(errMsg));
        setResultsLoading(false);
        return;
      }

      setResultsData(json);
    } catch (err: any) {
      setResultsError(String(err?.message ?? err));
    } finally {
      setResultsLoading(false);
    }
  };

  const closeResultsModal = () => {
    setResultsModalOpen(false);
    setResultsData(null);
    setResultsLoading(false);
    setResultsError(null);
  };

  // load quizzes on mount
  useEffect(() => {
    fetchQuizzesForTeacher().catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI: list item renderer
  const QuizRow: React.FC<{ q: QuizMeta }> = ({ q }) => {
    const id = q.id ?? q._id ?? q.quizId ?? q.id;
    return (
      <Card className="mb-3 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-lg text-slate-900 dark:text-white">{q.title ?? "Untitled"}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{q.subject ?? "No subject"}</div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openViewModal(String(id))}
              icon={<Eye className="w-4 h-4" />}
            >
              View
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => openCreateLobbyForQuiz(String(id))}
              icon={<Play className="w-4 h-4" />}
            >
              Lobby
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchResultsForQuiz(String(id))}
              icon={<BarChart2 className="w-4 h-4" />}
            >
              Results
            </Button>

            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDeleteQuiz(String(id))}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Scrutiny</h1>
            <div className="text-xs text-slate-500 dark:text-slate-400">Teacher Dashboard</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-300 hidden md:block">
              {auth.user?.email ?? "—"}
            </div>
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              icon={<LogOut className="w-4 h-4" />}
            >
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Create form */}
        <div className="lg:col-span-7 xl:col-span-8">
          <Card title="Create New Quiz" description="Design a new quiz for your students.">
            <form onSubmit={onCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Quiz Title"
                  placeholder="E.g. Midterm Exam - Algebra"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <Input
                  label="Subject"
                  placeholder="E.g. Mathematics"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">Questions</h3>
                  <Button type="button" size="sm" onClick={addQuestion} icon={<Plus className="w-4 h-4" />}>
                    Add Question
                  </Button>
                </div>

                {questions.map((q, qi) => (
                  <div key={qi} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <Input
                          label={`Question ${qi + 1}`}
                          placeholder="Enter question text"
                          value={q.questionText}
                          onChange={(e) => setQuestionText(qi, e.target.value)}
                        />

                        <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-3">
                              <input
                                type="radio"
                                name={`correct-${qi}`}
                                checked={q.correctAnswer === oi}
                                onChange={() => setCorrectAnswer(qi, oi)}
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                              />
                              <Input
                                placeholder={`Option ${oi + 1}`}
                                value={opt}
                                onChange={(e) => setOptionText(qi, oi, e.target.value)}
                                className="flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(qi, oi)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="ghost" onClick={() => addOption(qi)} className="mt-2">
                            + Add Option
                          </Button>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeQuestion(qi)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Remove Question"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setTitle("");
                    setSubject("");
                    setQuestions([emptyQuestion()]);
                    setMsg(null);
                    setSuccessId(null);
                  }}
                >
                  Reset
                </Button>
                <Button type="submit" loading={loading}>
                  Create Quiz
                </Button>
              </div>

              {msg && (
                <div className={`p-3 rounded-lg text-sm ${msg.includes("success") ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                  {msg}
                  {successId && <span className="block mt-1 font-mono text-xs opacity-80">ID: {successId}</span>}
                </div>
              )}
            </form>
          </Card>
        </div>

        {/* Right: Quizzes list */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">My Quizzes</h2>
            <Button size="sm" variant="ghost" onClick={() => fetchQuizzesForTeacher()} icon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : listError ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{listError}</div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <p>No quizzes found.</p>
              <p className="text-sm mt-1">Create your first quiz to get started.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
              {quizzes.map((q) => (
                <QuizRow key={q.id ?? q._id} q={q} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalQuiz?.title ?? "Quiz Details"}
        maxWidth="lg"
      >
        {modalLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : modalError ? (
          <div className="text-red-600">{modalError}</div>
        ) : modalQuiz ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Subject: {modalQuiz.subject}</span>
              <span className="font-mono text-xs">ID: {modalQuiz.id}</span>
            </div>

            <div className="space-y-4">
              {(modalQuiz.questions ?? []).map((q, i) => (
                <div key={i} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                  <div className="font-medium mb-3 text-slate-900 dark:text-white">
                    {i + 1}. {q.questionText}
                  </div>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.correctAnswer;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                            isCorrect 
                              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30" 
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <span className={`font-mono font-bold w-6 ${isCorrect ? "text-green-600 dark:text-green-400" : "text-slate-400"}`}>
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          <span>{opt}</span>
                          {isCorrect && <span className="ml-auto text-xs font-medium bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded text-green-700 dark:text-green-400">Correct</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-slate-500">No data available.</div>
        )}
      </Modal>

      {/* Create Lobby Modal */}
        <CreateLobbyModal
          quizId={createLobbyQuizId as string}
          onClose={() => setCreateLobbyModalOpen(false)}
          onCreated={onLobbyCreated}
        />

      {/* Lobby View Overlay */}
      {lobbyOpen && lobbySessionId && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 overflow-auto">
          <div className="max-w-4xl mx-auto p-6">
            <div className="mb-6">
              <Button variant="outline" onClick={closeLobbyView}>
                ← Back to Dashboard
              </Button>
            </div>
            <LobbyView
              sessionId={lobbySessionId}
              role="teacher"
              onClose={closeLobbyView}
            />
          </div>
        </div>
      )}

      {/* Results Modal */}
      <Modal
        isOpen={resultsModalOpen}
        onClose={closeResultsModal}
        title="Quiz Results"
        maxWidth="2xl"
      >
        {resultsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : resultsError ? (
          <div className="text-red-600">{resultsError}</div>
        ) : resultsData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{resultsData.totalSubmissions ?? 0}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Submissions</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{resultsData.averageScore ? Number(resultsData.averageScore).toFixed(1) : "—"}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Avg Score</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{resultsData.passRate ? `${Number(resultsData.passRate).toFixed(0)}%` : "—"}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Pass Rate</div>
              </div>
            </div>
            
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                  {(resultsData.submissions ?? []).map((sub: any, i: number) => (
                    <tr key={i}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        {sub.studentName ?? sub.studentEmail ?? "Anonymous"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {sub.score} / {sub.totalQuestions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-slate-500">No results found.</div>
        )}
      </Modal>
    </div>
  );
};
