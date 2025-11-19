// src/components/TeacherDashboard.tsx
import React, { useEffect, useState } from "react";
import { useAuthContext } from "../auth/AuthProvider";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

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

  // Lobby / Create lobby states (NEW)
  const [createLobbyModalOpen, setCreateLobbyModalOpen] = useState(false);
  const [createLobbyQuizId, setCreateLobbyQuizId] = useState<string | null>(null);
  const [lobbySessionId, setLobbySessionId] = useState<string | null>(null);
  const [lobbyPin, setLobbyPin] = useState<string | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);

  // Results modal states (NEW)
  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<any | null>(null);

  const auth = useAuthContext();
  const navigate = useNavigate();

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

  // --- helpers for create quiz (kept as before, with debug logs) ---
  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    console.log(`[TeacherDashboard] updateQuestion idx=${idx} patch=`, patch);
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const setQuestionText = (idx: number, text: string) => {
    console.log(`[TeacherDashboard] setQuestionText idx=${idx} text=`, text);
    updateQuestion(idx, { questionText: text });
  };

  const addOption = (qIdx: number) => {
    console.log(`[TeacherDashboard] addOption qIdx=${qIdx}`);
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
    console.log(`[TeacherDashboard] removeOption qIdx=${qIdx} optIdx=${optIdx}`);
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = q.options.filter((_, oi) => oi !== optIdx);
        if (newOpts.length < 2) {
          console.warn(`[TeacherDashboard] Attempted to remove option but minimum 2 options required (qIdx=${qIdx})`);
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
    console.log(`[TeacherDashboard] setOptionText qIdx=${qIdx} optIdx=${optIdx} text=`, text);
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: q.options.map((o, oi) => (oi === optIdx ? text : o)) } : q
      )
    );
  };

  const setCorrectAnswer = (qIdx: number, index: number) => {
    console.log(`[TeacherDashboard] setCorrectAnswer qIdx=${qIdx} index=${index}`);
    setQuestions((prev) => prev.map((q, i) => (i === qIdx ? { ...q, correctAnswer: index } : q)));
  };

  const addQuestion = () => {
    console.log("[TeacherDashboard] addQuestion");
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    console.log(`[TeacherDashboard] removeQuestion idx=${idx}`);
    setQuestions((prev) => prev.filter((_, i) => i !== idx) || [emptyQuestion()]);
  };

  const validate = (): { ok: boolean; error?: string } => {
    console.log("[TeacherDashboard] validate called", { title, subject, questions });
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

  // --- fetch list of quizzes and filter to this teacher (keeps previous behavior) ---
  const fetchQuizzesForTeacher = async () => {
    console.log("[TeacherDashboard] fetchQuizzesForTeacher start");
    setListError(null);
    setListLoading(true);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      console.log("[TeacherDashboard] token present:", Boolean(accessToken));

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

      console.log("[TeacherDashboard] GET /api/quizzes status:", resp.status);
      const text = await resp.text();
      console.log("[TeacherDashboard] GET /api/quizzes raw response:", text);

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.warn("[TeacherDashboard] could not parse quizzes response as JSON", parseErr);
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        console.error("[TeacherDashboard] fetch quizzes failed:", errMsg);
        setListError(errMsg);
        setListLoading(false);
        return;
      }

      const all: QuizMeta[] = Array.isArray(json) ? json : json?.quizzes ?? json?.data ?? [];
      console.log("[TeacherDashboard] fetched quizzes count:", (all || []).length);

      const userId = (auth.user as any)?.id ?? (auth.user as any)?.user?.id ?? null;
      const userEmail = (auth.user as any)?.email ?? (auth.user as any)?.user?.email ?? null;
      console.log("[TeacherDashboard] teacher identifiers:", { userId, userEmail });

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

      console.log("[TeacherDashboard] filtered quizzes count:", filtered.length);

      setQuizzes(filtered);
    } catch (err: any) {
      console.error("[TeacherDashboard] fetchQuizzesForTeacher error:", err);
      setListError(String(err?.message ?? err));
    } finally {
      setListLoading(false);
      console.log("[TeacherDashboard] fetchQuizzesForTeacher finished");
    }
  };

  // --- create quiz handler (kept, same as before) ---
  const onCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMsg(null);
    setSuccessId(null);

    console.log("[TeacherDashboard] onCreate started");

    const v = validate();
    if (!v.ok) {
      console.warn("[TeacherDashboard] validation failed:", v.error);
      setMsg(v.error ?? "Validation failed.");
      return;
    }

    setLoading(true);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      console.log("[TeacherDashboard] accessToken present:", Boolean(accessToken));

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

      console.log("[TeacherDashboard] payload:", payload);

      const resp = await fetch(`${apiBase}/api/quizzes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(payload),
      });

      console.log("[TeacherDashboard] POST /api/quizzes status:", resp.status);

      const text = await resp.text();
      console.log("[TeacherDashboard] POST /api/quizzes raw response:", text);

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
        console.log("[TeacherDashboard] parsed JSON response:", json);
      } catch (parseErr) {
        console.warn("[TeacherDashboard] response not JSON:", parseErr);
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        console.error("[TeacherDashboard] create failed:", errMsg);
        setMsg(`Create failed: ${errMsg}`);
        setLoading(false);
        return;
      }

      console.log("[TeacherDashboard] create success");
      setMsg("Quiz created successfully.");
      const createdId = json?.id ?? json?.quizId ?? json?.quiz?.id ?? null;
      console.log("[TeacherDashboard] createdId:", createdId);
      if (createdId) {
        setSuccessId(String(createdId));
      }

      setTitle("");
      setSubject("");
      setQuestions([emptyQuestion()]);

      // refresh list after creation
      await fetchQuizzesForTeacher();
    } catch (err: any) {
      console.error("Create quiz error:", err);
      setMsg("Network or server error: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
      console.log("[TeacherDashboard] onCreate finished");
    }
  };

  // --- fetch single quiz details for modal ---
  const fetchQuizDetails = async (id: string) => {
    console.log("[TeacherDashboard] fetchQuizDetails start id=", id);
    setModalError(null);
    setModalLoading(true);
    setModalQuiz(null);

    try {
      const sessRes = await supabase.auth.getSession();
      const session = sessRes?.data?.session ?? null;
      const accessToken = session?.access_token ?? null;

      console.log("[TeacherDashboard] token present for modal:", Boolean(accessToken));
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

      console.log("[TeacherDashboard] GET /api/quizzes/:id status:", resp.status);
      const text = await resp.text();
      console.log("[TeacherDashboard] GET /api/quizzes/:id raw response:", text);

      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
        console.log("[TeacherDashboard] parsed GET /api/quizzes/:id JSON:", json);
      } catch (parseErr) {
        console.warn("[TeacherDashboard] could not parse quiz detail response", parseErr);
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        console.error("[TeacherDashboard] fetch quiz details failed:", errMsg);
        setModalError(errMsg);
        setModalLoading(false);
        return;
      }

      // Backend may return quiz directly or { quiz: {...} }
      const quiz: QuizFull = json?.quiz ?? json ?? null;
      setModalQuiz(quiz);
      console.log("[TeacherDashboard] modal quiz set:", quiz);
    } catch (err: any) {
      console.error("[TeacherDashboard] fetchQuizDetails error:", err);
      setModalError(String(err?.message ?? err));
    } finally {
      setModalLoading(false);
      console.log("[TeacherDashboard] fetchQuizDetails finished");
    }
  };

  // open modal and start fetching
  const openViewModal = async (id: string) => {
    console.log("[TeacherDashboard] openViewModal id=", id);
    setViewingId(id);
    setModalOpen(true);
    // fetch details
    await fetchQuizDetails(id);
  };

  const closeModal = () => {
    console.log("[TeacherDashboard] closeModal");
    setModalOpen(false);
    setViewingId(null);
    setModalQuiz(null);
    setModalError(null);
    setModalLoading(false);
  };

  // logout handler
  const handleLogout = async () => {
    console.log("[TeacherDashboard] logout requested");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[TeacherDashboard] supabase signOut error:", error);
      } else {
        console.log("[TeacherDashboard] supabase signOut success");
      }
    } catch (err: any) {
      console.error("[TeacherDashboard] signOut threw:", err);
    } finally {
      try { auth.setRole(null); } catch (e) { console.warn("[TeacherDashboard] auth.setRole null failed:", e); }
      setQuizzes([]);
      setMsg(null);
      setSuccessId(null);
      // navigate("/");
    }
  };

  // open Create Lobby modal for a quiz (NEW)
  const openCreateLobbyForQuiz = (quizId: string) => {
    console.log("[TeacherDashboard] openCreateLobbyForQuiz", quizId);
    setCreateLobbyQuizId(quizId);
    setCreateLobbyModalOpen(true);
  };

  // called when CreateLobbyModal returns sessionId + pin (NEW)
  const onLobbyCreated = (sessionId: string, pin: string) => {
    console.log("[TeacherDashboard] onLobbyCreated sessionId=", sessionId, "pin=", pin);
    setCreateLobbyModalOpen(false);
    setLobbySessionId(sessionId);
    setLobbyPin(pin);
    setLobbyOpen(true);
    // Optionally fetch session details now; LobbyView will poll/manage
  };

  // close lobby view
  const closeLobbyView = () => {
    console.log("[TeacherDashboard] closeLobbyView");
    setLobbyOpen(false);
    setLobbySessionId(null);
    setLobbyPin(null);
  };

  // --- fetch results for a quiz (NEW) ---
  const fetchResultsForQuiz = async (quizId: string) => {
    console.log("[TeacherDashboard] fetchResultsForQuiz start quizId=", quizId);
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

      // Endpoint expected by backend: GET /api/quizzes/:id/results
      const url = `${apiBase}/api/quizzes/${encodeURIComponent(quizId)}/results`;
      console.log("[TeacherDashboard] GET results ->", url);

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
      } catch (parseErr) {
        console.warn("[TeacherDashboard] could not parse results response as JSON", parseErr, "raw:", text);
        json = null;
      }

      if (!resp.ok) {
        const errMsg = json?.error ?? json?.message ?? text ?? `Status ${resp.status}`;
        console.error("[TeacherDashboard] fetch results failed:", errMsg);
        setResultsError(String(errMsg));
        setResultsLoading(false);
        return;
      }

      console.log("[TeacherDashboard] fetch results success:", json);
      setResultsData(json);
    } catch (err: any) {
      console.error("[TeacherDashboard] fetchResultsForQuiz error:", err);
      setResultsError(String(err?.message ?? err));
    } finally {
      setResultsLoading(false);
      console.log("[TeacherDashboard] fetchResultsForQuiz finished");
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
      <div className="border rounded p-3 flex items-center justify-between">
        <div>
          <div className="font-medium">{q.title ?? "Untitled"}</div>
          <div className="text-xs text-gray-500">{q.subject ?? "No subject"} • id: {id}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
            onClick={() => {
              console.log("[TeacherDashboard] View quiz", id);
              openViewModal(String(id));
            }}
          >
            View
          </button>

          <button
            className="text-sm px-3 py-1 border rounded text-red-600 hover:bg-red-50"
            onClick={() => {
              console.log("[TeacherDashboard] Delete requested for quiz", id);
              alert("Delete not implemented yet.");
            }}
          >
            Delete
          </button>

          {/* NEW: Open Lobby button */}
          <button
            className="text-sm px-3 py-1 border rounded text-sky-600 hover:bg-sky-50"
            onClick={() => openCreateLobbyForQuiz(String(id))}
          >
            Open Lobby
          </button>

          {/* NEW: Results button */}
          <button
            className="text-sm px-3 py-1 border rounded text-amber-700 hover:bg-amber-50"
            onClick={() => {
              console.log("[TeacherDashboard] Results requested for quiz", id);
              fetchResultsForQuiz(String(id));
            }}
          >
            Results
          </button>
        </div>
      </div>
    );
  };

  // --- modal content renderer ---
  const ModalContent = () => {
    if (modalLoading) {
      return <div className="p-6">Loading quiz...</div>;
    }
    if (modalError) {
      return (
        <div className="p-6">
          <div className="text-red-600">Error: {modalError}</div>
        </div>
      );
    }
    if (!modalQuiz) {
      return <div className="p-6">No quiz data.</div>;
    }

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">{modalQuiz.title ?? "Untitled"}</h3>
            <div className="text-sm text-gray-500">{modalQuiz.subject ?? "No subject"}</div>
          </div>
          <div className="text-xs text-gray-400">id: {modalQuiz.id}</div>
        </div>

        <div className="space-y-4">
          {(modalQuiz.questions ?? []).map((q, i) => (
            <div key={i} className="border rounded p-3 bg-gray-50">
              <div className="font-medium mb-2">
                {i + 1}. {q.questionText}
              </div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctAnswer;
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 px-3 py-2 rounded ${isCorrect ? "bg-green-50 border border-green-200" : ""}`}
                    >
                      <div className={`w-6 text-sm font-semibold ${isCorrect ? "text-green-700" : "text-gray-600"}`}>{String.fromCharCode(65 + oi)}.</div>
                      <div className={`${isCorrect ? "text-green-700" : ""}`}>{opt}</div>
                      {isCorrect && <div className="ml-auto text-xs text-green-700 font-medium">Correct</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Simple layout: left = create form, right = list + modal
  return (
    <>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Left: Create form (2/3 width on large screens) */}
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold">Create Quiz</h1>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">Signed in as: {auth.user?.email ?? "—"}</div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 border rounded text-sm bg-red-50 hover:bg-red-100 text-red-700"
                >
                  Logout
                </button>
              </div>
            </div>

            <form onSubmit={onCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-sm font-medium text-gray-700 mb-1">Title</div>
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      console.log("[TeacherDashboard] title changed:", e.target.value);
                    }}
                    className="w-full rounded border px-3 py-2"
                    placeholder="E.g. Midterm Exam - Algebra"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-gray-700 mb-1">Subject</div>
                  <input
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      console.log("[TeacherDashboard] subject changed:", e.target.value);
                    }}
                    className="w-full rounded border px-3 py-2"
                    placeholder="E.g. Mathematics"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-medium">Questions</h2>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={addQuestion} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                      + Add question
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {questions.map((q, qi) => (
                    <div key={qi} className="border rounded p-4 bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <label className="block mb-2">
                            <div className="text-sm font-medium text-gray-700">Question {qi + 1}</div>
                            <input value={q.questionText} onChange={(e) => setQuestionText(qi, e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Enter question text" />
                          </label>

                          <div className="space-y-2">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <div className="flex items-center gap-2">
                                  <input type="radio" name={`correct-${qi}`} checked={q.correctAnswer === oi} onChange={() => setCorrectAnswer(qi, oi)} />
                                  <input value={opt} onChange={(e) => setOptionText(qi, oi, e.target.value)} className="rounded border px-2 py-1 w-full" placeholder={`Option ${oi + 1}`} />
                                </div>

                                <button type="button" onClick={() => removeOption(qi, oi)} className="text-sm text-red-600 hover:underline" title="Remove option">
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => addOption(qi)} className="text-sm px-3 py-1 border rounded hover:bg-gray-100">
                              + Option
                            </button>

                            <button type="button" onClick={() => removeQuestion(qi)} className="text-sm px-3 py-1 border rounded text-red-600 hover:bg-red-50">
                              Remove question
                            </button>
                          </div>
                        </div>

                        <div className="shrink-0 text-sm text-gray-500">
                          <div className="mb-2">Preview</div>
                          <div className="text-xs bg-white border rounded p-2 w-40">{q.questionText || "No question text"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  {loading ? "Creating..." : "Create Quiz"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    console.log("[TeacherDashboard] Reset form");
                    setTitle("");
                    setSubject("");
                    setQuestions([emptyQuestion()]);
                    setMsg(null);
                    setSuccessId(null);
                  }}
                  className="px-4 py-2 border rounded"
                >
                  Reset
                </button>
              </div>

              {msg && <div className="text-sm text-red-600">{msg}</div>}
              {successId && <div className="text-sm text-green-600">Created quiz id: {successId}</div>}
            </form>
          </div>

          {/* Right: Quizzes list (1/3 width on large screens) */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">My Quizzes</h2>
              <div>
                <button
                  onClick={() => {
                    console.log("[TeacherDashboard] Refresh quizzes list clicked");
                    fetchQuizzesForTeacher();
                  }}
                  className="text-sm px-2 py-1 border rounded"
                >
                  Refresh
                </button>
              </div>
            </div>

            {listLoading ? (
              <div className="text-sm text-gray-600">Loading quizzes...</div>
            ) : listError ? (
              <div className="text-sm text-red-600">Error: {listError}</div>
            ) : quizzes.length === 0 ? (
              <div className="text-sm text-gray-600">No quizzes yet. Create one on the left.</div>
            ) : (
              <div className="space-y-3">
                {quizzes.map((q) => (
                  <QuizRow key={String(q.id ?? q._id ?? q.quizId ?? Math.random())} q={q} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quiz detail modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          <div className="relative max-w-3xl w-full mx-4 bg-white rounded shadow-lg z-10 overflow-auto max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold">Quiz Details</div>
              <div>
                <button onClick={closeModal} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">
                  Close
                </button>
              </div>
            </div>

            <div><ModalContent /></div>
          </div>
        </div>
      )}

      {/* Create Lobby Modal (teacher) */}
      {createLobbyModalOpen && createLobbyQuizId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setCreateLobbyModalOpen(false); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 bg-white rounded shadow-lg p-4 max-w-md w-full">
            <CreateLobbyModal
              quizId={createLobbyQuizId}
              onCreated={(sessionId, pin) => onLobbyCreated(sessionId, pin)}
              onClose={() => setCreateLobbyModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Lobby view (teacher) */}
      {lobbyOpen && lobbySessionId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-4xl">
            <div className="bg-white rounded shadow">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Lobby</div>
                  <div className="font-semibold">Session: {lobbySessionId}</div>
                  {lobbyPin && <div className="text-xs text-gray-500">PIN: {lobbyPin}</div>}
                </div>
                <div>
                  <button onClick={closeLobbyView} className="px-3 py-1 border rounded">Close</button>
                </div>
              </div>

              <div className="p-4">
                <LobbyView sessionId={lobbySessionId} role="teacher" onClose={closeLobbyView} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results modal (UPDATED to match backend response) */}
      {resultsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) closeResultsModal(); }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative max-w-3xl w-full mx-4 bg-white rounded shadow-lg z-10 overflow-auto max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold">Quiz Results</div>
              <div>
                <button onClick={closeResultsModal} className="px-3 py-1 rounded border text-sm hover:bg-gray-100">
                  Close
                </button>
              </div>
            </div>

            <div className="p-4">
              {resultsLoading ? (
                <div className="text-sm text-gray-600">Loading results...</div>
              ) : resultsError ? (
                <div className="text-sm text-red-600">Error: {resultsError}</div>
              ) : !resultsData ? (
                <div className="text-sm text-gray-600">No results data.</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Quiz</div>
                    <div className="font-semibold">{resultsData.quizTitle ?? "Untitled"}</div>
                    <div className="text-xs text-gray-500">Total submissions: {resultsData.totalSubmissions ?? (resultsData.results?.length ?? 0)}</div>
                  </div>

                  {Array.isArray(resultsData.results) && resultsData.results.length === 0 ? (
                    <div className="text-sm text-gray-600">No submissions yet for this quiz.</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-left">
                            <th className="border-b py-2 px-2">MIS</th>
                            <th className="border-b py-2 px-2">Student Name</th>
                            <th className="border-b py-2 px-2">Score</th>
                            <th className="border-b py-2 px-2">Total Questions</th>
                            <th className="border-b py-2 px-2">Submitted At</th>
                            <th className="border-b py-2 px-2">Submission ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(resultsData.results ?? []).map((r: any) => (
                            <tr key={r.submissionId ?? r.mis ?? Math.random()}>
                              <td className="py-2 px-2 border-b">{r.mis ?? "—"}</td>
                              <td className="py-2 px-2 border-b">{r.studentName ?? "—"}</td>
                              <td className="py-2 px-2 border-b">{r.score ?? "—"}</td>
                              <td className="py-2 px-2 border-b">{r.totalQuestions ?? "—"}</td>
                              <td className="py-2 px-2 border-b">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                              <td className="py-2 px-2 border-b">{r.submissionId ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeacherDashboard;
