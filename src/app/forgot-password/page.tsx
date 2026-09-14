"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error.message));
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">🥗</div>
          <h1 className="mt-2 text-2xl font-bold text-brand-700">
            Восстановление пароля
          </h1>
        </div>

        {sent ? (
          <div className="card text-center text-sm">
            <div className="text-3xl">📬</div>
            <p className="mt-2">
              Ссылка для сброса пароля отправлена на {email}.
            </p>
            <Link href="/login" className="btn-primary mt-4 inline-block">
              На страницу входа
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="card space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Отправляем…" : "Отправить ссылку"}
            </button>

            <p className="text-center text-sm text-stone-500">
              <Link
                href="/login"
                className="font-medium text-brand-600 hover:underline"
              >
                ← Назад ко входу
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
