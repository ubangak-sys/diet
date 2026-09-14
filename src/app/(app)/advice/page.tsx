"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { DailyAdvice } from "@/lib/types";
import { formatDateRu, todayLocal } from "@/lib/utils";

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
  const [history, setHistory] = useState<DailyAdvice[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("daily_advice")
      .select("*")
      .eq("user_id", user.id)
      .order("advice_date", { ascending: false });
    setHistory(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function generate() {
    if (!user) return;
    setGenerating(true);
    setError("");

    const { data, error: fnError } = await supabase.functions.invoke(
      "ai-advice",
      { body: { date: todayLocal() } },
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
    await loadHistory();
  }

  const today = todayLocal();
  const todays = history.find((a) => a.advice_date === today);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Советы по рациону</h1>
          <p className="text-stone-500">
            ИИ анализирует ваши предпочтения и фактическое меню, чтобы
            предложить, что добавить в рацион.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="btn-primary"
        >
          {generating ? "ИИ думает…" : todays ? "Обновить совет на сегодня" : "Получить совет на сегодня"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {generating && (
        <div className="card flex items-center gap-3 text-stone-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-brand-600" />
          Составляем персональный совет — обычно занимает несколько секунд…
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Загрузка…</p>
      ) : history.length === 0 && !generating ? (
        <div className="card text-center text-stone-500">
          <div className="text-4xl">💡</div>
          <p className="mt-2">Советов пока нет.</p>
          <p className="text-sm">
            Заполните дневник питания и нажмите «Получить совет».
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((a) => (
            <article key={a.id} className="card">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold">
                  {formatDateRu(a.advice_date)}
                </h2>
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
