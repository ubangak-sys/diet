"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-errors";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          age: age ? Number(age) : null,
        },
      },
    });
    setLoading(false);

    if (error) {
      setError(authErrorMessage(error.message));
      return;
    }

    if (data.session) {
      // Подтверждение email отключено — сразу входим
      router.replace("/preferences");
    } else {
      setInfo(
        "Регистрация почти завершена! Мы отправили письмо для подтверждения email. После перехода по ссылке войдите на странице входа.",
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-4xl">🥗</div>
          <h1 className="mt-2 text-2xl font-bold text-brand-700">Рацион+</h1>
          <p className="text-sm text-stone-500">Создайте аккаунт</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label htmlFor="fullName" className="label">
              Имя
            </label>
            <input
              id="fullName"
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Как к вам обращаться"
            />
          </div>
          <div>
            <label htmlFor="age" className="label">
              Возраст
            </label>
            <input
              id="age"
              type="number"
              min={1}
              max={120}
              className="input"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
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
              Пароль (мин. 6 символов)
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
          {info && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
              {info}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Создаём…" : "Зарегистрироваться"}
          </button>

          <p className="text-center text-sm text-stone-500">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Войти
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
