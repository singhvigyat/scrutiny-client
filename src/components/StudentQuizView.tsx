// src/components/StudentQuizView.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { CheckCircle, AlertTriangle, Send } from "lucide-react";

interface Props {
  quiz: any;
  sessionId?: string | null;
  onComplete?: (quizId: string) => void;
}

export default function StudentQuizView({ quiz, sessionId, onComplete }: Props) {
  const [submittedResult, setSubmittedResult] = useState<any | null>(null);

  const handleOptionSelect = (qIndex: number, optIndex: number) => {
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const handleSubmit = async () => {
    if (!sessionId) {
      setError("Missing session ID. Cannot submit.");
      return;
    }

    // Validate all questions answered?
    const totalQ = quiz.questions?.length || 0;
    if (Object.keys(answers).length < totalQ) {
      if (!confirm("You haven't answered all questions. Submit anyway?")) {
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        setError("No access token. Please sign in again.");
        setSubmitting(false);
        return;
      }

      const payload = {
        answers: Object.entries(answers).map(([qIdx, optIdx]) => {
          const qIndex = Number(qIdx);
          const question = quiz.questions[qIndex];
          return {
            questionIndex: qIndex,
            questionId: question?.id ?? question?._id ?? undefined, // Send ID if available
            selectedOption: optIdx,
            answer: optIdx,
            value: question?.options[optIdx] || "",
          };
        }),
      };
      console.log("[StudentQuizView] Submitting payload:", payload);

      const resp = await fetch(`${apiBase}/api/sessions/${encodeURIComponent(sessionId)}/submit`, {
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
        setError(`Submission failed: ${errMsg}`);
        setSubmitting(false);
        return;
      }

      console.log("Submission successful:", json);
      setSubmittedResult(json);
      
      // Notify parent to clear quiz view (optional, maybe wait for user to click "Done")
      // if (onComplete && quiz.id) {
      //   onComplete(String(quiz.id));
      // }
    } catch (err: any) {
      console.error("Submit error:", err);
      setError("Network error: " + err.message);
      setSubmitting(false);
    }
  };

  if (!quiz) return <div className="p-6 text-center text-slate-500">Loading quiz...</div>;

  if (submittedResult) {
    return (
      <div className="max-w-md mx-auto pt-12 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mb-4">
          <CheckCircle className="w-10 h-10" />
        </div>
        
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Quiz Submitted!</h2>
        <p className="text-slate-600 dark:text-slate-400">
          Your answers have been successfully sent to the server.
        </p>

        <Card className="mt-8 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium mb-2">Your Score</div>
          <div className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">
            {submittedResult.score ?? 0}
            <span className="text-2xl text-slate-400 dark:text-slate-500 font-normal"> / {submittedResult.totalQuestions ?? quiz.questions?.length ?? "?"}</span>
          </div>
        </Card>

        <div className="pt-8">
          <Button 
            size="lg" 
            className="w-full"
            onClick={() => {
              if (onComplete && quiz.id) {
                onComplete(String(quiz.id));
              }
            }}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const questions = quiz.questions || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Card className="border-l-4 border-l-indigo-500">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{quiz.title}</h2>
            <p className="text-slate-500 dark:text-slate-400">{quiz.subject}</p>
          </div>
          <div className="text-right text-sm text-slate-500 dark:text-slate-400">
            <div>{questions.length} Questions</div>
            {sessionId && <div className="font-mono text-xs mt-1">Session: {sessionId}</div>}
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {questions.map((q: any, i: number) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 dark:bg-slate-700">
              {answers[i] !== undefined && (
                <div className="absolute top-0 left-0 w-full h-full bg-green-500"></div>
              )}
            </div>
            
            <div className="pl-4">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
                <span className="text-slate-400 mr-2">{i + 1}.</span>
                {q.questionText}
              </h3>

              <div className="space-y-3">
                {q.options?.map((opt: string, optIdx: number) => {
                  const isSelected = answers[i] === optIdx;
                  return (
                    <label
                      key={optIdx}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-500 ring-1 ring-indigo-500"
                          : "bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${i}`}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        checked={isSelected}
                        onChange={() => handleOptionSelect(i, optIdx)}
                      />
                      <span className={`ml-3 ${isSelected ? "text-indigo-900 dark:text-indigo-100 font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-700">
        <Button
          size="lg"
          onClick={handleSubmit}
          loading={submitting}
          icon={<Send className="w-5 h-5" />}
        >
          Submit Quiz
        </Button>
      </div>
    </div>
  );
}
