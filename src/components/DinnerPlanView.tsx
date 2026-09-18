"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useFamily } from "./FamilyProvider";
import { supabase } from "@/lib/supabase";
import { recordVerdict } from "@/lib/tried";
import type { DinnerPlan } from "@/lib/types";

export function DinnerPlanView({
  plan,
  adviceId,
}: {
  plan: DinnerPlan;
  adviceId?: string;
}) {
  const { user } = useAuth();
  const { family } = useFamily();
  const members = family?.members ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const isParent = me?.member_role === "mom" || me?.member_role === "dad";
  const kids = members.filter((m) => m.member_role === "kid");
  const [forUserId, setForUserId] = useState("");

  useEffect(() => {
    if (user) setForUserId(user.id);
  }, [user]);

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [verdicts, setVerdicts] = useState<Record<number, "liked" | "disliked">>(
    {},
  );

  useEffect(() => {
    const s = new Set<number>();
    plan.shopping.forEach((item, i) => {
      if (item.checked) s.add(i);
    });
    setChecked(s);
    setVerdicts({});
  }, [plan]);

  async function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    if (adviceId) {
      await supabase.rpc("toggle_shopping_item", {
        p_advice: adviceId,
        p_index: i,
      });
    }
  }

  async function mark(i: number, dish: string, verdict: "liked" | "disliked") {
    if (!forUserId) return;
    setVerdicts((prev) => ({ ...prev, [i]: verdict }));
    await recordVerdict(forUserId, dish, verdict);
  }

  return (
    <div className="space-y-4">
      {isParent && kids.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">Кто пробовал:</span>
          <select
            value={forUserId}
            onChange={(e) => setForUserId(e.target.value)}
            className="input !w-auto !py-1 text-xs"
          >
            <option value={user!.id}>
              {me?.avatar_emoji ? `${me.avatar_emoji} ` : ""}Вы
            </option>
            {kids.map((k) => (
              <option key={k.user_id} value={k.user_id}>
                {`${k.avatar_emoji ? k.avatar_emoji + " " : ""}${
                  k.full_name || k.email || "Ребёнок"
                }`}
              </option>
            ))}
          </select>
        </div>
      )}

      {plan.dinners.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">🍽️ Ужины</h3>
          <ul className="space-y-2">
            {plan.dinners.map((d, i) => (
              <li key={i} className="rounded-lg bg-stone-50 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {d.day != null && (
                        <span className="mr-1 text-stone-400">
                          День {d.day}.
                        </span>
                      )}
                      {d.title}
                    </div>
                    {d.why && (
                      <div className="mt-0.5 text-xs text-stone-500">
                        {d.why}
                      </div>
                    )}
                    {d.variants && d.variants.length > 0 && (
                      <div className="mt-1 text-xs text-stone-500">
                        <span className="font-medium text-stone-600">
                          Варианты:
                        </span>{" "}
                        {d.variants.join(" · ")}
                      </div>
                    )}
                    {d.time && (
                      <div className="mt-1 text-xs text-stone-500">
                        ⏱️ {d.time}
                      </div>
                    )}
                    {d.steps && d.steps.length > 0 && (
                      <div className="mt-1 rounded-md bg-white px-2 py-1 text-xs text-stone-600">
                        <div className="font-medium">👨‍🍳 Приготовление:</div>
                        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                          {d.steps.map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => mark(i, d.title, "liked")}
                      className={`rounded-full px-2 py-0.5 text-sm transition ${
                        verdicts[i] === "liked"
                          ? "bg-brand-600 text-white"
                          : "bg-white text-stone-500 hover:bg-stone-200"
                      }`}
                      title="Зашло"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(i, d.title, "disliked")}
                      className={`rounded-full px-2 py-0.5 text-sm transition ${
                        verdicts[i] === "disliked"
                          ? "bg-red-600 text-white"
                          : "bg-white text-stone-500 hover:bg-stone-200"
                      }`}
                      title="Не зашло"
                    >
                      👎
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.shopping.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">🛒 Купить</h3>
          <ul className="space-y-1">
            {plan.shopping.map((s, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-0.5 accent-brand-600"
                  />
                  <span
                    className={
                      checked.has(i) ? "text-stone-400 line-through" : ""
                    }
                  >
                    {s.item}
                    {s.amount ? (
                      <span className="text-stone-500"> — {s.amount}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.lunchboxes && plan.lunchboxes.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">🍱 Ланчбоксы на завтра</h3>
          <ul className="space-y-2">
            {plan.lunchboxes.map((l, i) => (
              <li key={i} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
                <div className="font-medium">{l.for}</div>
                {l.items && l.items.length > 0 && (
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-stone-600">
                    {l.items.map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                )}
                {l.note && (
                  <div className="mt-1 text-xs text-stone-500">💡 {l.note}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
