"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { getMyFamily } from "@/lib/family";
import { DIETARY_OPTIONS, Family, Preferences } from "@/lib/types";
import { arrayToText, textToArray } from "@/lib/utils";

const EMPTY: Preferences = {
  user_id: "",
  liked_dishes: [],
  disliked_dishes: [],
  cuisines: [],
  allergies: [],
  dietary_restrictions: [],
  goal: null,
  notes: null,
  updated_at: "",
};

export default function PreferencesPage() {
  const { user } = useAuth();

  const [family, setFamily] = useState<Family | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");

  const [liked, setLiked] = useState("");
  const [disliked, setDisliked] = useState("");
  const [cuisines, setCuisines] = useState("");
  const [allergies, setAllergies] = useState("");
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const members = family?.members ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const isParent = me?.member_role === "mom" || me?.member_role === "dad";
  const kids = members.filter((m) => m.member_role === "kid");
  const editingChild = !!selectedUserId && selectedUserId !== user?.id;

  const loadFamily = useCallback(async () => {
    try {
      setFamily(await getMyFamily());
    } catch {
      setFamily(null);
    }
  }, []);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  useEffect(() => {
    if (user) setSelectedUserId(user.id);
  }, [user]);

  useEffect(() => {
    if (!selectedUserId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("profiles")
        .select("full_name, age")
        .eq("id", selectedUserId)
        .maybeSingle(),
      supabase
        .from("preferences")
        .select("*")
        .eq("user_id", selectedUserId)
        .maybeSingle(),
    ]).then(([profileRes, prefsRes]) => {
      const prof = profileRes.data;
      setFullName(prof?.full_name ?? "");
      setAge(prof?.age != null ? String(prof.age) : "");

      const p = (prefsRes.data ?? EMPTY) as Preferences;
      setLiked(arrayToText(p.liked_dishes));
      setDisliked(arrayToText(p.disliked_dishes));
      setCuisines(arrayToText(p.cuisines));
      setAllergies(arrayToText(p.allergies));
      setRestrictions(p.dietary_restrictions ?? []);
      setGoal(p.goal ?? "");
      setNotes(p.notes ?? "");
      setLoading(false);
    });
  }, [selectedUserId]);

  function toggleRestriction(opt: string) {
    setRestrictions((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setSaving(true);
    setMessage("");

    const ageNum = age.trim() ? Number(age) : null;

    const profileUpdate = editingChild
      ? { age: ageNum }
      : { full_name: fullName.trim() || null, age: ageNum };

    const profileRes = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", selectedUserId);

    const prefsRes = await supabase.from("preferences").upsert(
      {
        user_id: selectedUserId,
        liked_dishes: textToArray(liked),
        disliked_dishes: textToArray(disliked),
        cuisines: textToArray(cuisines),
        allergies: textToArray(allergies),
        dietary_restrictions: restrictions,
        goal: goal.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    setSaving(false);
    if (profileRes.error) {
      setMessage(`Ошибка: ${profileRes.error.message}`);
    } else if (prefsRes.error) {
      setMessage(`Ошибка: ${prefsRes.error.message}`);
    } else {
      setMessage("Сохранено ✅ ИИ учтёт это в советах и рекомендациях.");
      await loadFamily();
    }
  }

  if (loading) {
    return <p className="text-stone-500">Загрузка…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Профиль и предпочтения</h1>
        <p className="text-stone-500">
          Эти данные помогают ИИ предлагать подходящие блюда и не предлагать
          неподходящие.
        </p>
      </div>

      {isParent && kids.length > 0 && (
        <div className="card">
          <label htmlFor="memberSelect" className="label">
            Чьи предпочтения редактируете
          </label>
          <select
            id="memberSelect"
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

      <form onSubmit={onSubmit} className="card space-y-5">
        <div>
          <h2 className="mb-3 font-semibold">
            {editingChild ? "Профиль ребёнка" : "Профиль"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="label">
                Имя
              </label>
              <input
                id="fullName"
                type="text"
                className="input disabled:bg-stone-50"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={editingChild}
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
                placeholder="Например: 34"
              />
            </div>
          </div>
        </div>

        <hr className="border-stone-200" />

        <div>
          <h2 className="mb-3 font-semibold">Предпочтения в еде</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="liked" className="label">
                Что {editingChild ? "любит" : "вы любите"} 🥰
              </label>
              <textarea
                id="liked"
                className="input min-h-[90px]"
                value={liked}
                onChange={(e) => setLiked(e.target.value)}
                placeholder={"Паста, курица, гречка\nСырники, яблоки"}
              />
              <p className="mt-1 text-xs text-stone-400">
                Через запятую или с новой строки.
              </p>
            </div>
            <div>
              <label htmlFor="disliked" className="label">
                Что {editingChild ? "не любит" : "не любите"} 🙅
              </label>
              <textarea
                id="disliked"
                className="input min-h-[90px]"
                value={disliked}
                onChange={(e) => setDisliked(e.target.value)}
                placeholder={"Печень, кинза, сельдерей"}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cuisines" className="label">
                Любимые кухни 🌍
              </label>
              <textarea
                id="cuisines"
                className="input min-h-[90px]"
                value={cuisines}
                onChange={(e) => setCuisines(e.target.value)}
                placeholder={"Итальянская, грузинская\nАзиатская"}
              />
            </div>
            <div>
              <label htmlFor="allergies" className="label">
                Аллергии / непереносимость ⚠️
              </label>
              <textarea
                id="allergies"
                className="input min-h-[90px]"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder={"Орехи, лактоза, морепродукты"}
              />
              <p className="mt-1 text-xs text-amber-600">
                Это строгие запреты — ИИ никогда их не предложит.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <span className="label">Ограничения в питании</span>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleRestriction(opt)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    restrictions.includes(opt)
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="goal" className="label">
                Цель 🎯
              </label>
              <input
                id="goal"
                type="text"
                className="input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Например: больше белка, больше овощей"
              />
            </div>
            <div>
              <label htmlFor="notes" className="label">
                Дополнительные заметки 📌
              </label>
              <input
                id="notes"
                type="text"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Режим дня, тренировки, бюджет…"
              />
            </div>
          </div>
        </div>

        {message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              message.startsWith("Ошибка")
                ? "bg-red-50 text-red-600"
                : "bg-brand-50 text-brand-700"
            }`}
          >
            {message}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving
            ? "Сохраняем…"
            : editingChild
              ? "Сохранить предпочтения ребёнка"
              : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
