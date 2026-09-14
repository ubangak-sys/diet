"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { MEAL_TYPES, MealEntry, MealType, mealTypeLabel } from "@/lib/types";
import { formatDateRu, todayLocal } from "@/lib/utils";

export default function LogPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayLocal());
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [dishName, setDishName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadEntries() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", user.id)
      .eq("entry_date", date)
      .order("created_at", { ascending: true });
    setEntries(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!dishName.trim()) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.from("meal_entries").insert({
      user_id: user!.id,
      entry_date: date,
      meal_type: mealType,
      dish_name: dishName.trim(),
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDishName("");
    setNotes("");
    await loadEntries();
  }

  async function removeEntry(id: string) {
    await supabase.from("meal_entries").delete().eq("id", id);
    await loadEntries();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Дневник питания</h1>
          <p className="text-stone-500">
            Фиксируйте, что вы ели, по приёмам пищи.
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={addEntry} className="card space-y-4 lg:col-span-2">
          <h2 className="font-semibold">Добавить приём пищи</h2>

          <div>
            <label className="label">Приём пищи</label>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMealType(m.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    mealType === m.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="dish" className="label">
              Блюдо / продукты
            </label>
            <input
              id="dish"
              type="text"
              required
              className="input"
              value={dishName}
              onChange={(e) => setDishName(e.target.value)}
              placeholder="Например: овсянка с ягодами"
            />
          </div>

          <div>
            <label htmlFor="notes" className="label">
              Заметки (необязательно)
            </label>
            <textarea
              id="notes"
              className="input min-h-[70px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Порция, ощущения, рецепт…"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? "Сохраняем…" : "Добавить"}
          </button>
        </form>

        <section className="card lg:col-span-3">
          <h2 className="mb-3 font-semibold">
            Меню за {formatDateRu(date)}
          </h2>
          {loading ? (
            <p className="text-sm text-stone-500">Загрузка…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-stone-500">
              Записей за этот день пока нет.
            </p>
          ) : (
            <div className="space-y-4">
              {MEAL_TYPES.map((mt) => {
                const items = entries.filter((e) => e.meal_type === mt.value);
                if (items.length === 0) return null;
                return (
                  <div key={mt.value}>
                    <div className="mb-1 text-sm font-semibold text-stone-600">
                      {mt.emoji} {mealTypeLabel(mt.value)}
                    </div>
                    <ul className="space-y-1">
                      {items.map((e) => (
                        <li
                          key={e.id}
                          className="group flex items-start justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {e.dish_name}
                            </div>
                            {e.notes && (
                              <div className="text-xs text-stone-500">
                                {e.notes}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeEntry(e.id)}
                            className="text-xs text-stone-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                            title="Удалить"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
