"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";

interface TriedRow {
  dish: string;
  verdict: string;
}

export function TriedFoods() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TriedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("tried_foods")
      .select("dish, verdict")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as TriedRow[]);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return <p className="text-sm text-stone-500">Загрузка…</p>;
  }

  const map = new Map<string, { liked: number; disliked: number }>();
  for (const r of rows) {
    const c = map.get(r.dish) ?? { liked: 0, disliked: 0 };
    if (r.verdict === "liked") c.liked++;
    else if (r.verdict === "disliked") c.disliked++;
    map.set(r.dish, c);
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
      {list.map(([dish, c]) => {
        const banned = c.disliked >= 5 && c.disliked > c.liked;
        return (
          <li
            key={dish}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <span className="text-sm font-medium">{dish}</span>
            <span className="flex items-center gap-2 text-xs">
              <span className="text-stone-500">👍 {c.liked}</span>
              <span className="text-stone-500">👎 {c.disliked}</span>
              {banned && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-600">
                  не предлагать
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
