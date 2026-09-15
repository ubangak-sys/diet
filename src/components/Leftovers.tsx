"use client";

import { useCallback, useEffect, useState } from "react";
import { useFamily } from "./FamilyProvider";
import { supabase } from "@/lib/supabase";

interface Leftover {
  id: string;
  dish: string;
  amount: string | null;
  cooked_on: string | null;
}

export function Leftovers() {
  const { family } = useFamily();
  const familyId = family?.id;
  const [items, setItems] = useState<Leftover[]>([]);
  const [dish, setDish] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!familyId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("leftovers")
      .select("*")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as Leftover[]);
    setLoading(false);
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!dish.trim() || !familyId) return;
    setBusy(true);
    const { error } = await supabase.from("leftovers").insert({
      family_id: familyId,
      dish: dish.trim(),
      amount: amount.trim() || null,
    });
    setBusy(false);
    if (!error) {
      setDish("");
      setAmount("");
      await load();
    }
  }

  async function remove(id: string) {
    await supabase.from("leftovers").delete().eq("id", id);
    await load();
  }

  async function clearAll() {
    if (!familyId) return;
    if (!confirm("Убрать все остатки из списка?")) return;
    await supabase.from("leftovers").delete().eq("family_id", familyId);
    await load();
  }

  if (!family) return null;

  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">🍲 Осталось готовое</h2>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-stone-400 hover:text-red-500"
          >
            Очистить
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-stone-500">
          Пока пусто. Добавьте, что осталось готовым — ИИ учтёт это в плане
          ужинов.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 py-2"
            >
              <span className="text-sm">
                {it.dish}
                {it.amount && (
                  <span className="text-stone-500"> — {it.amount}</span>
                )}
              </span>
              <button
                onClick={() => remove(it.id)}
                className="text-xs text-stone-400 hover:text-red-500"
                title="Удалить"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
        <input
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          placeholder="Блюдо, напр. борщ"
          className="input flex-1"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="2 порции"
          className="input w-28"
        />
        <button
          type="submit"
          disabled={busy || !dish.trim()}
          className="btn-secondary"
        >
          Добавить
        </button>
      </form>
    </section>
  );
}
