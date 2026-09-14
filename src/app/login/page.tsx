"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(authErrorMessage(error.message));
    } else {
      router.replace("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">🥗</div>
          <h1 className="mt-2 text-2xl font-bold text-brand-700">Рацион+</h1>
          <p className="text-sm text-stone-500">Расширяйте рацион осознанно</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
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
            {loading ? "Входим…" : "Войти"}
          </button>

          <p className="text-center text-sm text-stone-500">
            Нет аккаунта?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Зарегистрироваться
            </Link>
          </p>
          <p className="text-center text-sm text-stone-500">
            <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
              Забыли пароль?
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
