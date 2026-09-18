"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useFamily } from "./FamilyProvider";
import { Avatar } from "./Avatar";
import { FeedbackModal } from "./FeedbackModal";

const NAV = [
  { href: "/", label: "Главная", emoji: "🏠" },
  { href: "/log", label: "Дневник", emoji: "📝" },
  { href: "/family", label: "Семья", emoji: "👨‍👩‍👧" },
  { href: "/preferences", label: "Предпочтения", emoji: "🥗" },
  { href: "/advice", label: "Советы", emoji: "💡" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { family, error: familyError } = useFamily();
  const me = family?.members.find((m) => m.user_id === user?.id);
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">🥗</span>
              <span className="text-lg font-bold text-brand-700">Рацион+</span>
            </Link>

            <div className="flex items-center gap-3">
              {me && (
                <Avatar
                  emoji={me.avatar_emoji}
                  color={me.avatar_color}
                  role={me.member_role}
                  size="sm"
                />
              )}
              <span className="hidden text-sm text-stone-500 md:inline">
                {user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="btn-secondary !px-3 !py-1.5"
              >
                Выйти
              </button>
            </div>
          </div>

          <nav className="mt-3 flex flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <span className="mr-1">{item.emoji}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {familyError && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-3">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Не удалось загрузить данные семьи: {familyError}
          </p>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-stone-200 py-6 text-center">
        <button
          onClick={() => setFeedbackOpen(true)}
          className="text-xs text-stone-400 underline hover:text-stone-600"
        >
          Обратная связь · сообщить о пожелании
        </button>
      </footer>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
