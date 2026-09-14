"use client";

import { useState } from "react";
import type { DinnerPlan } from "@/lib/types";

export function DinnerPlanView({ plan }: { plan: DinnerPlan }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {plan.dinners.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">🍽️ Ужины</h3>
          <ul className="space-y-2">
            {plan.dinners.map((d, i) => (
              <li key={i} className="rounded-lg bg-stone-50 px-3 py-2">
                <div className="text-sm font-medium">
                  {d.day != null && (
                    <span className="mr-1 text-stone-400">День {d.day}.</span>
                  )}
                  {d.title}
                </div>
                {d.why && (
                  <div className="mt-0.5 text-xs text-stone-500">{d.why}</div>
                )}
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
          <ul className="space-y-1">
            {plan.lunchboxes.map((l, i) => (
              <li key={i} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
                <span className="font-medium">{l.for}:</span> {l.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
