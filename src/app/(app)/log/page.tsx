"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useFamily } from "@/components/FamilyProvider";
import { Avatar } from "@/components/Avatar";
import { MEAL_TYPES, MealEntry, MealType, mealTypeLabel } from "@/lib/types";
import { addDays, formatDateRu, todayLocal } from "@/lib/utils";

export default function LogPage() {
  const { user } = useAuth();
  const { family } = useFamily();
  const [date, setDate] = useState(todayLocal());
  const [entries, setEntries] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const [recentDishes, setRecentDishes] = useState<string[]>([]);

  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [forUserIds, setForUserIds] = useState<string[]>([]);
  const [dishName, setDishName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const members = family?.members ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const isParent = me?.member_role === "mom" || me?.member_role === "dad";
  const kids = members.filter((m) => m.member_role === "kid");
  const kidsSet = new Set(kids.map((k) => k.user_id));

  useEffect(() => {
    if (user) setForUserIds([user.id]);
  }, [user]);

  const forOptions = [
    {
      id: user?.id ?? "",
      name: "Вы",
      role: me?.member_role,
      avatar_emoji: me?.avatar_emoji ?? null,
      avatar_color: me?.avatar_color ?? null,
    },
    ...kids.map((k) => ({
      id: k.user_id,
      name: k.full_name || k.email || "Ребёнок",
      role: k.member_role,
      avatar_emoji: k.avatar_emoji,
      avatar_color: k.avatar_color,
    })),
  ].filter((o) => o.id);

  function toggleFor(id: string) {
    setForUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function loadEntries() {
    if (!user) return;
    setLoading(true);
    // Без фильтра по user_id: RLS вернёт свои + записи членов семьи
    const { data } = await supabase
      .from("meal_entries")
      .select("*")
      .eq("entry_date", date)
      .order("created_at", { ascending: true });
    setEntries(data ?? []);
    setLoading(false);
  }

  async function loadRecentDishes() {
    if (!user) return;
    const { data } = await supabase
      .from("meal_entries")
      .select("dish_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const seen = new Set<string>();
    const dishes: string[] = [];
    for (const e of data ?? []) {
      const n = String(e.dish_name ?? "").trim();
      // дробим блюдо на состав: по запятой, "/", "+", "с", "и", "или"
      const parts = n
        .split(/[,;+/]|\s+(?:с|со|и|или)\s+/gi)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
      for (const part of parts) {
        const key = part.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          dishes.push(part);
        }
      }
      if (dishes.length >= 15) break;
    }
    setRecentDishes(dishes);
  }

  useEffect(() => {
    loadEntries();
    loadRecentDishes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date]);

  function displayName(uid: string): string {
    if (uid === user?.id) return "Вы";
    const m = members.find((x) => x.user_id === uid);
    return m?.full_name || m?.email || "Участник";
  }

  function canDelete(e: MealEntry): boolean {
    return e.user_id === user?.id || (isParent && kidsSet.has(e.user_id));
  }

  function toggleChip(part: string) {
    const current = dishName
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const idx = current.findIndex(
      (c) => c.toLowerCase() === part.toLowerCase(),
    );
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(part);
    }
    setDishName(current.join(", "));
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!dishName.trim()) return;
    const targets =
      isParent && kids.length > 0 ? forUserIds : user ? [user.id] : [];
    if (targets.length === 0) {
      setError("Выберите, для кого добавить приём пищи.");
      return;
    }
    setSaving(true);
    setError("");
    const rows = targets.map((uid) => ({
      user_id: uid,
      entry_date: date,
      meal_type: mealType,
      dish_name: dishName.trim(),
      notes: notes.trim() || null,
    }));
    const { error } = await supabase.from("meal_entries").insert(rows);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDishName("");
    setNotes("");
    await loadEntries();
    await loadRecentDishes();
  }

  async function removeEntry(id: string) {
    await supabase.from("meal_entries").delete().eq("id", id);
    await loadEntries();
  }

  async function copyPreviousDay() {
    if (!user) return;
    const targets = isParent && kids.length > 0 ? forUserIds : [user.id];
    if (targets.length === 0) {
      setError("Выберите, для кого скопировать.");
      return;
    }
    const prev = addDays(date, -1);
    const { data } = await supabase
      .from("meal_entries")
      .select("*")
      .eq("entry_date", prev)
      .eq("meal_type", mealType)
      .in("user_id", targets);
    const items = data ?? [];
    if (items.length === 0) {
      setError(
        "В предыдущий день для выбранных людей и приёма пищи записей нет.",
      );
      return;
    }
    setSaving(true);
    setError("");
    const rows = items.map((e) => ({
      user_id: e.user_id,
      entry_date: date,
      meal_type: e.meal_type,
      dish_name: e.dish_name,
      notes: e.notes,
    }));
    const { error } = await supabase.from("meal_entries").insert(rows);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    await loadEntries();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Дневник питания</h1>
          <p className="text-stone-500">
            {family
              ? "Общий дневник семьи — видны приёмы пищи всех участников."
              : "Фиксируйте, что вы ели, по приёмам пищи."}
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

          {isParent && kids.length > 0 && (
            <div>
              <span className="label">Для кого</span>
              <div className="flex flex-wrap gap-2">
                {forOptions.map((o) => {
                  const active = forUserIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleFor(o.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <Avatar
                        emoji={o.avatar_emoji}
                        color={o.avatar_color}
                        role={o.role}
                        size="sm"
                      />
                      <span>{o.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Можно выбрать нескольких — запись добавится каждому.
              </p>
            </div>
          )}

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

          <button
            type="button"
            onClick={copyPreviousDay}
            disabled={saving}
            className="btn-secondary w-full"
            title="Скопировать выбранный приём пищи для выбранных людей с предыдущего дня"
          >
            📋 Скопировать прошлый приём
          </button>

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
            {recentDishes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recentDishes.map((d) => {
                  const active = dishName
                    .split(/,\s*/)
                    .some((c) => c.toLowerCase() === d.toLowerCase());
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleChip(d)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-stone-200 bg-stone-50 text-stone-600 hover:border-brand-500 hover:bg-brand-50"
                      }`}
                    >
                      {active ? "✓ " : ""}
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
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
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {e.dish_name}
                              </span>
                              <span className="rounded bg-white px-1.5 py-0.5 text-xs text-stone-500">
                                {displayName(e.user_id)}
                              </span>
                            </div>
                            {e.notes && (
                              <div className="text-xs text-stone-500">
                                {e.notes}
                              </div>
                            )}
                          </div>
                          {canDelete(e) && (
                            <button
                              onClick={() => removeEntry(e.id)}
                              className="text-xs text-stone-400 transition hover:text-red-500"
                              title="Удалить"
                            >
                              ✕
                            </button>
                          )}
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
