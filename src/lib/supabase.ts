import { createClient } from "@supabase/supabase-js";

// Публичные переменные (встраиваются в статическую сборку). anon-key безопасен:
// доступ к данным ограничивает Row Level Security на стороне Supabase.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://YOUR-PROJECT.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "YOUR-ANON-KEY";

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
