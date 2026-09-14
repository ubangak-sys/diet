"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { DailyAdvice, MealEntry, Profile, mealTypeLabel } from "@/lib/types";
import { todayLocal } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayMeals, setTodayMeals] = useState<MealEntry[]>([]);
  const [latestAdvice, setLatestAdvice] = useState<DailyAdvice | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = todayLocal();

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
  }, [user]);

  const name = profile?.full_name || user?.email?.split("@")[0] || "друг";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Привет, {name}! 👋
        </h1>
        <p className="text-stone-500">
          Вот сводка по вашему рациону на сегодня.
        </p>
      </div>

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
            <h2 className="font-semibold">Последний совет</h2>
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
