-- ============================================================================
-- «Рацион+» — пожелания по ужину + обратная связь + родители видят советы детей
-- Выполнить в SQL Editor после 0004_parent_children.sql
-- ============================================================================

-- 1. Пожелания по ужину (мягкие предпочтения для рекомендации)
alter table public.preferences
  add column if not exists dinner_wishes text[] not null default '{}';

-- 2. Обратная связь (пишет Edge Function, читает разработчик)
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
-- Клиент не читает и не пишет напрямую: только Edge Function через service role.

-- 3. Родители видят персональные советы детей
drop policy if exists "daily_advice_select_own" on public.daily_advice;
create policy "daily_advice_select_own_or_child" on public.daily_advice
  for select using (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );
