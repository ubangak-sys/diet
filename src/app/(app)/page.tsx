"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getMyFamily } from "@/lib/family";
import {
  DailyAdvice,
  Family,
  FamilyAdvice,
  MealEntry,
  Profile,
  mealTypeLabel,
} from "@/lib/types";
import { todayLocal } from "@/lib/utils";

function extractError(err: unknown): string {
  if (!err) return "Неизвестная ошибка";
  const e = err as { context?: unknown; message?: string };
  try {
    if (e.context) {
      const parsed =
        typeof e.context === "string" ? JSON.parse(e.context) : e.context;
      const inner = parsed as { error?: string };
      if (inner?.error) return inner.error;
    }
  } catch {
    /* ignore */
  }
  return e.message ?? "Неизвестная ошибка";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [latestAdvice, setLatestAdvice] = useState<DailyAdvice | null>(null);

  const [family, setFamily] = useState<Family | null>(null);
  const [dinner, setDinner] = useState<FamilyAdvice | null>(null);
  const [generatingDinner, setGeneratingDinner] = useState(false);
  const [dinnerError, setDinnerError] = useState("");

  const today = todayLocal();

  const loadDinner = useCallback(async () => {
    if (!family) {
      setDinner(null);
      return;
    }
    const { data } = await supabase
      .from("family_advice")
      .select("*")
      .eq("family_id", family.id)
      .order("advice_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    setDinner(data ?? null);
  }, [family]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));

    supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .order("created_at", { ascending: true })
      .then(({ data }) => setTodayMeals(data ?? []));

    supabase
      .from("daily_advice")
      .select("*")
      .eq("user_id", user.id)
      .order("advice_date", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatestAdvice(data ?? null));

    getMyFamily()
      .then(setFamily)
      .catch(() => setFamily(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    loadDinner();
  }, [loadDinner]);

  async function generateDinner() {
    if (!user || !family) return;
    setGeneratingDinner(true);
    setDinnerError("");

    const { data, error: fnError } = await supabase.functions.invoke(
      "ai-advice",
      { body: { date: todayLocal(), mode: "dinner" } },
    );

    setGeneratingDinner(false);

    if (fnError) {
      setDinnerError(extractError(fnError));
      return;
    }
    if (data?.error) {
      setDinnerError(data.error);
      return;
    }
    await loadDinner();
  }

  const name = profile?.full_name || user?.email?.split("@")[0] || "друг";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Привет, {name}! 👋</h1>
        <p className="text-stone-500">
          Вот сводка по вашему рациону на сегодня.
        </p>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Рекомендация по ужину 🍽️
            </h2>
            <p className="text-sm text-stone-500">
              {family
                ? "Что приготовить всей семье на ужин."
                : "Объединитесь в семью, чтобы получать рекомендации по ужину."}
            </p>
          </div>
          {family && (
            <button
              onClick={generateDinner}
              disabled={generatingDinner}
              className="btn-primary"
            >
              {generatingDinner
                ? "ИИ думает…"
                : dinner?.advice_date === today
                  ? "Обновить"
                  : "Получить рекомендацию"}
            </button>
          )}
        </div>

        {dinnerError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {dinnerError}
          </p>
        )}

        {!family ? (
          <p className="mt-3 text-sm text-stone-500">
            <Link
              href="/family"
              className="font-medium text-brand-600 hover:underline"
            >
              Создайте или присоединитесь к семье →
            </Link>
          </p>
        ) : generatingDinner ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-stone-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
            Составляем рекомендацию по ужину…
          </div>
        ) : dinner ? (
          <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-stone-700">
            {dinner.content}
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Рекомендации пока нет — нажмите «Получить рекомендацию».
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/log" className="card hover:border-brand-500 transition">
          <div className="text-3xl">📝</div>
          <div className="mt-2 text-2xl font-bold">{todayMeals.length}</div>
          <div className="text-sm text-stone-500">приёмов пищи сегодня</div>
        </Link>
        <Link
          href="/preferences"
          className="card hover:border-brand-500 transition"
        >
          <div className="text-3xl">🥗</div>
          <div className="mt-2 font-semibold">Предпочтения</div>
          <div className="text-sm text-stone-500">
            Что вы любите и не переносите
          </div>
        </Link>
        <Link href="/advice" className="card hover:border-brand-500 transition">
          <div className="text-3xl">💡</div>
          <div className="mt-2 font-semibold">Совет на сегодня</div>
          <div className="text-sm text-stone-500">
            {latestAdvice ? "Уже готов" : "Получить от ИИ"}
          </div>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Сегодняшнее меню</h2>
            <Link
              href="/log"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Открыть дневник →
            </Link>
          </div>
          {todayMeals.length === 0 ? (
            <p className="text-sm text-stone-500">
              Пока пусто. Запишите первый приём пищи, чтобы ИИ мог дать точный
              совет.
            </p>
          ) : (
            <ul className="space-y-2">
              {todayMeals.map((m) => (
                <li key={m.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                    {mealTypeLabel(m.meal_type)}
                  </span>
                  <span>{m.dish_name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Личный совет</h2>
            <Link
              href="/advice"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Все советы →
            </Link>
          </div>
          {latestAdvice ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">
              {latestAdvice.content.slice(0, 400)}
              {latestAdvice.content.length > 400 ? "…" : ""}
            </p>
          ) : (
            <div className="text-sm text-stone-500">
              <p>Совета пока нет.</p>
              <Link
                href="/advice"
                className="mt-2 inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Получить первый совет
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
