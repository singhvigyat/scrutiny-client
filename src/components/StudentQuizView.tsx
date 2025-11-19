// src/components/StudentQuizView.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type QuizFull = {
  id?: string;
  title?: string;
  subject?: string;
  questions?: Array<{
    questionText?: string;
    options?: string[];
    [k: string]: any;
  }>;
  sessionId?: string;
  session?: { id?: string; [k: string]: any };
  quizSessionId?: string;
  [k: string]: any;
};

type Props = {
  quiz: QuizFull;
  // optional explicit session id passed in by parent dashboard
  sessionId?: string | null;
  onComplete?: () => void;
};

export default function StudentQuizView({ quiz, sessionId: propSessionId, onComplete }: Props): React.ReactElement {
  const [answers, setAnswers] = useState<number[]>(
    (quiz.questions ?? []).map(() => -1)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  const findSessionId = (): string | null => {
    // 1) explicit prop from parent (highest priority)
    if (propSessionId) {
      console.log("[StudentQuizView] using sessionId passed as prop:", propSessionId);
      return String(propSessionId);
    }

    // 2) storage keys
    try {
      const candidates = [
        (window as any).sessionStorage?.getItem?.("currentSessionId"),
        (window as any).localStorage?.getItem?.("currentSessionId"),
        (window as any).sessionStorage?.getItem?.("sessionId"),
        (window as any).localStorage?.getItem?.("sessionId"),
      ];
      for (const c of candidates) {
        if (c) {
          console.log("[StudentQuizView] found sessionId from storage:", c);
          return String(c);
        }
      }
    } catch (e) {
      console.warn("[StudentQuizView] storage access error while looking for sessionId", e);
    }

    // 3) properties on quiz object
    const quizCandidates = [
      quiz.sessionId,
      quiz.quizSessionId,
      quiz.session?.id,
      quiz.session?.sessionId,
    ];
    for (const cand of quizCandidates) {
      if (cand) {
        console.log("[StudentQuizView] found sessionId on quiz object:", cand);
        return String(cand);
      }
    }

    console.warn("[StudentQuizView] no sessionId found via prop/storage/quiz object");
    return null;
  };

  useEffect(() => {
    setAnswers((prev) => {
      const qlen = (quiz.questions ?? []).length;
      if (prev.length === qlen) return prev;
      const next = Array.from({ length: qlen }).map((_, i) => prev[i] ?? -1);
      return next;
    });
  }, [quiz.questions]);

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (disabled) return;
    setAnswers((prev) => {
      const copy = prev.slice();
      copy[qIdx] = optIdx;
      return copy;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSubmitMsg(null);
    setSubmitError(null);

    const qCount = (quiz.questions ?? []).length;
    if (qCount === 0) {
      setSubmitError("No questions in this quiz.");
      return;
    }

    const sessionId = findSessionId();
    if (!sessionId) {
      setSubmitError("Session ID not found. Please join the lobby using the PIN before the quiz starts.");
      return;
    }

    setSubmitting(true);
    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;

      if (!accessToken) {
        setSubmitError("No authentication token. Please sign in again.");
        setSubmitting(false);
        return;
      }

      const payload = { answers: answers.map((a) => (a == null ? null : Number(a))) };

      const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
      const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";
      const url = `${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/submit`;

      console.log("[StudentQuizView] submitting answers to", url, "payload:", payload);

      const resp = await fetch(url, {
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
        json = null;
      }

      if (!resp.ok) {
        const errMsg = (json && json.message) || text || `Status ${resp.status}`;
        console.error("[StudentQuizView] submit failed:", errMsg);
        setSubmitError(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
        setSubmitting(false);
        return;
      }

      console.log("[StudentQuizView] submit success:", json ?? text);
      setSubmitMsg("Submitted successfully.");
      setDisabled(true);
      
      // Notify parent to redirect/refresh
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1500); // small delay to show success message
      }
    } catch (err: any) {
      console.error("[StudentQuizView] submit error:", err);
      setSubmitError(String(err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm max-w-4xl mx-auto">
      <div className="mb-4">
        <div className="text-xs text-gray-500">Live Quiz</div>
        <h1 className="text-2xl font-semibold">{quiz.title ?? "Untitled Quiz"}</h1>
        {quiz.subject && <div className="text-sm text-gray-600">{quiz.subject}</div>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {(quiz.questions ?? []).map((q, qi) => (
          <div key={qi} className="border rounded p-4 bg-gray-50">
            <div className="font-medium mb-2">
              {qi + 1}. {q.questionText}
            </div>

            <div className="space-y-2">
              {q.options?.map((opt, oi) => {
                const checked = answers[qi] === oi;
                return (
                  <label key={oi} className={`flex items-center gap-3 p-2 rounded hover:bg-white ${checked ? "bg-white border" : ""}`}>
                    <input
                      type="radio"
                      name={`q-${qi}`}
                      checked={checked}
                      onChange={() => handleSelect(qi, oi)}
                      disabled={disabled}
                    />
                    <div className="flex-1 text-sm">{opt}</div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {submitError && <div className="text-sm text-red-600">{submitError}</div>}
        {submitMsg && <div className="text-sm text-green-600">{submitMsg}</div>}
        {answers.length > 0 && answers.some((a) => a < 0) && !disabled && (
          <div className="text-xs text-yellow-700">Warning: some questions are unanswered. Submission will record unanswered items as null.</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={submitting || disabled} className="bg-green-600 text-white px-4 py-2 rounded">
            {submitting ? "Submitting..." : disabled ? "Submitted" : "Submit answers"}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              if (disabled) return;
              setAnswers((quiz.questions ?? []).map(() => -1));
              setSubmitMsg(null);
              setSubmitError(null);
            }}
            className="px-4 py-2 border rounded"
          >
            Clear answers
          </button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <div>Debug: sessionId detection attempted — check console for detected session id.</div>
      </div>
    </div>
  );
}
