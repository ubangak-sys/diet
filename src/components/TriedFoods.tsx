"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useFamily } from "./FamilyProvider";
import { supabase } from "@/lib/supabase";

interface TriedRow {
  dish: string;
  verdict: string;
  user_id: string;
  created_at: string;
}

const PAUSE_DAYS = 14;

export function TriedFoods() {
  const { user } = useAuth();
  const { family } = useFamily();
  const [rows, setRows] = useState<TriedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const members = family?.members ?? [];
  const ids =
    members.length > 0
      ? members.map((m) => m.user_id)
      : user
        ? [user.id]
        : [];

  const nameOf = (id: string): string => {
    if (id === user?.id) return "Вы";
    const m = members.find((x) => x.user_id === id);
    return m?.full_name || m?.email || "Участник";
  };

  useEffect(() => {
    if (!user || ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    supabase
      .from("tried_foods")
      .select("dish, verdict, user_id, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as TriedRow[]);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, family?.id]);

  if (loading) {
    return <p className="text-sm text-stone-500">Загрузка…</p>;
  }

  // группируем по блюду
  const map = new Map<string, { liked: string[]; disliked: string[]; paused: boolean }>();
  const pauseCutoff = Date.now() - PAUSE_DAYS * 24 * 3600 * 1000;
  for (const r of rows) {
    const key = r.dish;
    const c = map.get(key) ?? { liked: [], disliked: [], paused: false };
    const who = nameOf(r.user_id);
    if (r.verdict === "liked") {
      if (!c.liked.includes(who)) c.liked.push(who);
    } else if (r.verdict === "disliked") {
      if (!c.disliked.includes(who)) c.disliked.push(who);
      // если есть свежий дизлайк — метка паузы
      const ts = new Date(r.created_at).getTime();
      if (!Number.isNaN(ts) && ts >= pauseCutoff) {
        c.paused = true;
      }
    }
    map.set(key, c);
  }
  const list = [...map.entries()];

  if (list.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Пока ничего не отмечали. Ставьте 👍/👎 на блюдах в рекомендации по ужину.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stone-100">
      {list.map(([dish, c]) => (
        <li
          key={dish}
          className="flex flex-wrap items-center justify-between gap-2 py-2"
        >
          <span className="text-sm font-medium">{dish}</span>
          <span className="flex items-center gap-2 text-xs">
            {c.liked.length > 0 && (
              <span className="text-stone-500">👍 {c.liked.join(", ")}</span>
            )}
            {c.disliked.length > 0 && (
              <span className="text-stone-500">👎 {c.disliked.join(", ")}</span>
            )}
            {c.paused && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                пауза
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
