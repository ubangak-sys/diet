"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getMyFamily } from "@/lib/family";
import { DailyAdvice, Family, FamilyAdvice } from "@/lib/types";
import { formatDateRu, todayLocal } from "@/lib/utils";

type Tab = "personal" | "family";

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

export default function AdvicePage() {
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [tab, setTab] = useState<Tab>("personal");

  const [personal, setPersonal] = useState<DailyAdvice[]>([]);
  const [familyAdvice, setFamilyAdvice] = useState<FamilyAdvice[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPersonal = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_advice")
      .select("*")
      .eq("user_id", user.id)
      .order("advice_date", { ascending: false });
    setPersonal(data ?? []);
  }, [user]);

  const loadFamilyAdvice = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from("family_advice")
      .select("*")
      .eq("family_id", family.id)
      .order("advice_date", { ascending: false });
    setFamilyAdvice(data ?? []);
  }, [family]);

  useEffect(() => {
    (async () => {
      try {
        const f = await getMyFamily();
        setFamily(f);
      } catch {
        setFamily(null);
      }
      await loadPersonal();
      setLoading(false);
    })();
  }, [loadPersonal]);

  useEffect(() => {
    if (family) loadFamilyAdvice();
  }, [family, loadFamilyAdvice]);

  async function generate(mode: Tab) {
    if (!user) return;
    setGenerating(true);
    setError("");

    const { data, error: fnError } = await supabase.functions.invoke(
      "ai-advice",
      { body: { date: todayLocal(), mode } },
    );

    setGenerating(false);

    if (fnError) {
      setError(extractError(fnError));
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }
    if (mode === "family") await loadFamilyAdvice();
    else await loadPersonal();
  }

  const today = todayLocal();
  const currentList = tab === "family" ? familyAdvice : personal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Советы по рациону</h1>
          <p className="text-stone-500">
            ИИ анализирует предпочтения и фактическое меню, чтобы предложить,
            что добавить в рацион.
          </p>
        </div>
      </div>

      {family && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab("personal")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "personal"
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Личный совет
          </button>
          <button
            onClick={() => setTab("family")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "family"
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Семейный совет 👨‍👩‍👧
          </button>
        </div>
      )}

      {tab === "family" && !family && (
        <div className="card text-center text-stone-500">
          <div className="text-4xl">👨‍👩‍👧</div>
          <p className="mt-2">Вы ещё не в семье.</p>
          <p className="text-sm">
            <Link href="/family" className="font-medium text-brand-600 hover:underline">
              Создайте или присоединитесь к семье
            </Link>
            , чтобы получать общий совет.
          </p>
        </div>
      )}

      {!(tab === "family" && !family) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-500">
            {tab === "family"
              ? "Совет для всей семьи с учётом предпочтений и меню каждого."
              : "Персональный совет с учётом ваших предпочтений и меню."}
          </p>
          <button
            onClick={() => generate(tab)}
            disabled={generating}
            className="btn-primary"
          >
            {generating
              ? "ИИ думает…"
              : currentList.some((a) => a.advice_date === today)
                ? "Обновить совет на сегодня"
                : "Получить совет на сегодня"}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {generating && (
        <div className="card flex items-center gap-3 text-stone-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
          Составляем {tab === "family" ? "семейный" : "персональный"} совет —
          обычно занимает несколько секунд…
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Загрузка…</p>
      ) : currentList.length === 0 && !generating && !(tab === "family" && !family) ? (
        <div className="card text-center text-stone-500">
          <div className="text-4xl">💡</div>
          <p className="mt-2">Советов пока нет.</p>
          <p className="text-sm">
            Заполните дневник питания и нажмите «Получить совет».
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((a) => (
            <article key={a.id} className="card">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold">{formatDateRu(a.advice_date)}</h2>
                {a.advice_date === today && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    сегодня
                  </span>
                )}
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">
                {a.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
