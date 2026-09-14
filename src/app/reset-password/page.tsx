"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error.message));
      return;
    }
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">🔑</div>
          <h1 className="mt-2 text-2xl font-bold text-brand-700">
            Новый пароль
          </h1>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label htmlFor="password" className="label">
              Новый пароль (мин. 6 символов)
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Сохраняем…" : "Сохранить пароль"}
          </button>
        </form>
      </div>
    </div>
  );
}
