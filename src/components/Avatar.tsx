"use client";

import { FAMILY_ROLES } from "@/lib/types";

const SIZE_CLASS: Record<string, string> = {
  sm: "h-6 w-6 text-sm",
  md: "h-9 w-9 text-lg",
  lg: "h-14 w-14 text-3xl",
};

export function Avatar({
  emoji,
  color,
  role,
  size = "md",
}: {
  emoji?: string | null;
  color?: string | null;
  role?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const fallback = FAMILY_ROLES.find((r) => r.value === role)?.emoji ?? "👤";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full leading-none ${SIZE_CLASS[size]}`}
      style={{ backgroundColor: color || "#e7e5e4" }}
    >
      {emoji || fallback}
    </span>
  );
}
