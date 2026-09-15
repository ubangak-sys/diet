"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useFamily } from "@/components/FamilyProvider";
import { DailyAdvice, FamilyAdvice } from "@/lib/types";
import { formatDateRu, todayLocal } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";
import { DinnerPlanView } from "@/components/DinnerPlanView";
import { TriedFoods } from "@/components/TriedFoods";
import { extractError } from "@/lib/edge-errors";

type Tab = "personal" | "dinner";

export default function AdvicePage() {
  const { user } = useAuth();
  const { family } = useFamily();
  const [tab, setTab] = useState<Tab>("personal");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [personal, setPersonal] = useState<DailyAdvice[]>([]);
  const [dinnerAdvice, setDinnerAdvice] = useState<FamilyAdvice[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const members = family?.members ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const isParent = me?.member_role === "mom" || me?.member_role === "dad";
  const kids = members.filter((m) => m.member_role === "kid");

  const loadPersonal = useCallback(async () => {
    if (!selectedUserId) return;
    const { data } = await supabase
      .from("daily_advice")
      .select("*")
      .eq("user_id", selectedUserId)
      .order("advice_date", { ascending: false });
    setPersonal(data ?? []);
  }, [selectedUserId]);

  const loadDinnerAdvice = useCallback(async () => {
    if (!family) return;
    const { data } = await supabase
      .from("family_advice")
      .select("*")
      .eq("family_id", family.id)
      .order("advice_date", { ascending: false });
    setDinnerAdvice(data ?? []);
  }, [family]);

  useEffect(() => {
    if (user) setSelectedUserId(user.id);
  }, [user]);

  useEffect(() => {
    loadPersonal().finally(() => setLoading(false));
  }, [loadPersonal]);

  useEffect(() => {
    if (family) loadDinnerAdvice();
  }, [family, loadDinnerAdvice]);

  async function generate(mode: Tab) {
    if (!user) return;
    setGenerating(true);
    setError("");

    const body: Record<string, unknown> = { date: todayLocal(), mode };
    if (mode === "personal" && selectedUserId !== user.id) {
      body.target_user_id = selectedUserId;
    }

    const { data, error: fnError } = await supabase.functions.invoke(
      "ai-advice",
      { body },
    );

    setGenerating(false);

    if (fnError) {
      setError(await extractError(fnError));
      return;
    }
    if (data?.error) {
      setError(data.error);
      return;
    }
    if (mode === "dinner") await loadDinnerAdvice();
    else await loadPersonal();
  }

  const today = todayLocal();
  const currentList = tab === "dinner" ? dinnerAdvice : personal;
  const selectedKid = kids.find((k) => k.user_id === selectedUserId);

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
            onClick={() => setTab("dinner")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === "dinner"
                ? "bg-brand-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Рекомендация по ужину 🍽️
          </button>
        </div>
      )}

      {tab === "personal" && isParent && kids.length > 0 && (
        <div className="card">
          <label htmlFor="adviceUser" className="label">
            Чей личный совет показать
          </label>
          <select
            id="adviceUser"
            className="input"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value={user!.id}>Мои (вы)</option>
            {kids.map((k) => (
              <option key={k.user_id} value={k.user_id}>
                {k.full_name || k.email || "Ребёнок"}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === "dinner" && !family && (
        <div className="card text-center text-stone-500">
          <div className="text-4xl">🍽️</div>
          <p className="mt-2">Вы ещё не в семье.</p>
          <p className="text-sm">
            <Link href="/family" className="font-medium text-brand-600 hover:underline">
              Создайте или присоединитесь к семье
            </Link>
            , чтобы получать рекомендацию по общему ужину.
          </p>
        </div>
      )}

      {!(tab === "dinner" && !family) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-500">
            {tab === "dinner"
              ? isParent
                ? "Что приготовить на общий семейный ужин + список покупок."
                : "План ужинов составляет мама/папа."
              : selectedKid
                ? `Персональный совет для: ${selectedKid.full_name || "ребёнка"}.`
                : "Персональный совет с учётом ваших предпочтений и меню."}
          </p>
          {(tab !== "dinner" || isParent) && (
            <button
              onClick={() => generate(tab)}
              disabled={generating}
              className="btn-primary"
            >
              {generating
                ? "ИИ думает…"
                : currentList.some((a) => a.advice_date === today)
                  ? "Обновить на сегодня"
                  : "Получить на сегодня"}
            </button>
          )}
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
          Составляем {tab === "dinner" ? "рекомендацию по ужину" : "персональный совет"} —
          обычно занимает несколько секунд…
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Загрузка…</p>
      ) : currentList.length === 0 && !generating && !(tab === "dinner" && !family) ? (
        <div className="card text-center text-stone-500">
          <div className="text-4xl">💡</div>
          <p className="mt-2">Пока пусто.</p>
          <p className="text-sm">
            Заполните дневник питания и нажмите «Получить на сегодня».
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
              {"plan" in a && a.plan ? (
                <DinnerPlanView plan={a.plan} adviceId={a.id} />
              ) : (
                <Markdown content={a.content} />
              )}
            </article>
          ))}
        </div>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">История новинок 🧪</h2>
        <TriedFoods />
      </section>
    </div>
  );
}
