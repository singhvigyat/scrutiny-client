// src/components/EnterPinModal.tsx
import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";

interface EnterPinModalProps {
  open: boolean;
  onClose: () => void;
  onJoined?: (sessionId: string, quizId?: string | null) => void;
}

export default function EnterPinModal({ open, onClose, onJoined }: EnterPinModalProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "";
  const apiBase = BACKEND_URL ? BACKEND_URL.replace(/\/$/, "") : "/api";

  const joinWithPin = async () => {
    setMsg(null);
    if (!pin.trim()) {
      setMsg("Please enter a PIN.");
      return;
    }

    setLoading(true);
    try {
      const sessRes = await supabase.auth.getSession();
      const accessToken = sessRes?.data?.session?.access_token ?? null;
      if (!accessToken) {
        setMsg("No auth token. Please sign in.");
        setLoading(false);
        return;
      }

      const resp = await fetch(`${apiBase}/api/sessions/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        console.warn("[EnterPinModal] join returned non-JSON:", text.slice(0, 400));
      }

      if (!resp.ok) {
        const errMsg = json?.message ?? text ?? `Status ${resp.status}`;
        setMsg(`Join failed: ${errMsg}`);
        setLoading(false);
        return;
      }

      // server expected shape:
      // { message, sessionId, quizId, teacherId }
      const sessionId = json?.sessionId ?? json?.session?.id ?? null;
      const quizId = json?.quizId ?? json?.quiz_id ?? json?.quiz?.id ?? null;

      console.log("[EnterPinModal] joined session", sessionId, "quizId=", quizId);
      setMsg("Joined lobby. Waiting for teacher to start the quiz.");

      // notify parent of both sessionId and quizId (quizId may be null, but usually present)
      onJoined?.(String(sessionId), quizId ? String(quizId) : null);

      // keep modal open so student sees the lobby; parent can close if desired
    } catch (err: any) {
      console.error("[EnterPinModal] join error:", err);
      setMsg("Network or server error: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Enter PIN"
      maxWidth="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Enter the PIN provided by your teacher to join the quiz session.
        </p>

        <Input
          label="PIN Code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="e.g. 961971"
          autoFocus
        />

        {msg && (
          <div className={`text-sm p-2 rounded ${
            msg.includes("Joined") 
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {msg}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={joinWithPin} loading={loading}>
            Join Session
          </Button>
        </div>
      </div>
    </Modal>
  );
}
