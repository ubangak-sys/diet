"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";
import { extractError } from "@/lib/edge-errors";

export function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setEmail(user?.email ?? "");
      setMessage("");
      setDone(false);
      setError("");
    }
  }, [open, user]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");
    const { data, error: fnError } = await supabase.functions.invoke(
      "send-feedback",
      { body: { name, email, message } },
    );
    setSending(false);
    if (fnError) {
      setError(await extractError(fnError));
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }
    setDone(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Обратная связь</h2>
        <p className="text-sm text-stone-500">
          Пожелания и отзывы — напрямую разработчику.
        </p>

        {done ? (
          <div className="mt-4 text-center">
            <div className="text-3xl">🙏</div>
            <p className="mt-2 text-sm">Спасибо! Ваше сообщение отправлено.</p>
            <button onClick={onClose} className="btn-primary mt-4">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="fbName" className="label">
                Имя
              </label>
              <input
                id="fbName"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
              />
            </div>
            <div>
              <label htmlFor="fbEmail" className="label">
                Email
              </label>
              <input
                id="fbEmail"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="fbMessage" className="label">
                Сообщение
              </label>
              <textarea
                id="fbMessage"
                required
                className="input min-h-[120px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ваши пожелания или отзыв…"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={sending}
                className="btn-primary flex-1"
              >
                {sending ? "Отправляем…" : "Отправить"}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary">
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
