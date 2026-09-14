-- ============================================================================
-- Приложение «Рацион+» — схема базы данных Supabase
-- Запустить в SQL Editor (Supabase Dashboard → SQL Editor → New query)
-- ============================================================================

-- 1. Профиль пользователя (создаётся автоматически триггером при регистрации)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- 2. Предпочтения по блюдам (одна строка на пользователя)
create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  liked_dishes text[] not null default '{}',
  disliked_dishes text[] not null default '{}',
  cuisines text[] not null default '{}',
  allergies text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  goal text,
  notes text,
  updated_at timestamptz not null default now()
);

-- 3. Ежедневный лог приёмов пищи
create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  dish_name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meal_entries_user_date_idx
  on public.meal_entries (user_id, entry_date desc);

-- 4. Ежедневный ИИ-совет (одна запись на пользователя на дату)
create table if not exists public.daily_advice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  advice_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now(),
  unique (user_id, advice_date)
);

-- ============================================================================
-- Триггер: автосоздание профиля при регистрации
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- Row Level Security: пользователь видит/меняет только свои данные
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.meal_entries enable row level security;
alter table public.daily_advice enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- preferences
drop policy if exists "preferences_select_own" on public.preferences;
create policy "preferences_select_own" on public.preferences
  for select using (auth.uid() = user_id);

drop policy if exists "preferences_insert_own" on public.preferences;
create policy "preferences_insert_own" on public.preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_update_own" on public.preferences
  for update using (auth.uid() = user_id);

-- meal_entries
drop policy if exists "meal_entries_select_own" on public.meal_entries;
create policy "meal_entries_select_own" on public.meal_entries
  for select using (auth.uid() = user_id);

drop policy if exists "meal_entries_insert_own" on public.meal_entries;
create policy "meal_entries_insert_own" on public.meal_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "meal_entries_delete_own" on public.meal_entries;
create policy "meal_entries_delete_own" on public.meal_entries
  for delete using (auth.uid() = user_id);

drop policy if exists "meal_entries_update_own" on public.meal_entries;
create policy "meal_entries_update_own" on public.meal_entries
  for update using (auth.uid() = user_id);

-- daily_advice: читать свои; запись разрешена только через Edge Function
drop policy if exists "daily_advice_select_own" on public.daily_advice;
create policy "daily_advice_select_own" on public.daily_advice
  for select using (auth.uid() = user_id);

drop policy if exists "daily_advice_insert_own" on public.daily_advice;
create policy "daily_advice_insert_own" on public.daily_advice
  for insert with check (auth.uid() = user_id);

drop policy if exists "daily_advice_update_own" on public.daily_advice;
create policy "daily_advice_update_own" on public.daily_advice
  for update using (auth.uid() = user_id);
