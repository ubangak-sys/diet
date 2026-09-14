-- ============================================================================
-- «Рацион+» — семья (одна семья на пользователя, вход по коду-приглашению)
-- Запустить в SQL Editor после 0001_init.sql
-- ============================================================================

-- 1. Таблица семей
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2. Участники семей
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- одна семья на пользователя (жёсткая гарантия на уровне БД)
create unique index if not exists family_members_user_unique
  on public.family_members (user_id);

-- 3. Семейный ИИ-совет
create table if not exists public.family_advice (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  advice_date date not null default current_date,
  content text not null,
  created_at timestamptz not null default now(),
  unique (family_id, advice_date)
);

-- ============================================================================
-- Вспомогательные функции (SECURITY DEFINER — обходят RLS, чтобы не было
-- рекурсии в политиках). Принимают uid как параметр.
-- ============================================================================
create or replace function public.my_family_id(uid uuid)
returns uuid
language sql security definer stable set search_path = public
as $$
  select family_id from public.family_members where user_id = uid limit 1;
$$;

create or replace function public.is_same_family(a uuid, b uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.family_members x
    join public.family_members y on y.family_id = x.family_id
    where x.user_id = a and y.user_id = b
  );
$$;

create or replace function public.is_family_owner(uid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.family_members where user_id = uid and role = 'owner'
  );
$$;

-- ============================================================================
-- RPC для операций с семьёй (вызываются из клиента через supabase.rpc)
-- ============================================================================

-- создать семью (пользователь становится владельцем)
create or replace function public.create_family(fam_name text, fam_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'Вы уже состоите в семье';
  end if;
  if exists (select 1 from public.families where invite_code = upper(fam_code)) then
    raise exception 'Такой код уже занят, попробуйте ещё раз';
  end if;

  insert into public.families (name, invite_code, owner_id)
  values (fam_name, upper(fam_code), auth.uid())
  returning id into fid;

  insert into public.family_members (family_id, user_id, role)
  values (fid, auth.uid(), 'owner');

  return fid;
end;
$$;

-- присоединиться по коду
create or replace function public.join_family(fam_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'Вы уже состоите в семье';
  end if;
  select id into fid from public.families where invite_code = upper(fam_code);
  if fid is null then raise exception 'Код не найден'; end if;

  insert into public.family_members (family_id, user_id, role)
  values (fid, auth.uid(), 'member');

  return fid;
end;
$$;

-- покинуть семью (владелец при выходе распускает семью)
create or replace function public.leave_family()
returns void
language plpgsql security definer set search_path = public
as $$
declare fid uuid; is_owner boolean;
begin
  select family_id, (role = 'owner') into fid, is_owner
  from public.family_members where user_id = auth.uid();
  if fid is null then return; end if;

  if is_owner then
    delete from public.families where id = fid; -- каскад удаляет участников и советы
  else
    delete from public.family_members where family_id = fid and user_id = auth.uid();
  end if;
end;
$$;

-- владелец удаляет участника (только из своей семьи, не владельца)
create or replace function public.remove_family_member(target uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.family_members
                 where user_id = auth.uid() and role = 'owner') then
    raise exception 'Только владелец может удалять участников';
  end if;

  delete from public.family_members
  where user_id = target
    and role <> 'owner'
    and family_id = (select family_id from public.family_members where user_id = auth.uid());
end;
$$;

-- получить свою семью (с участниками и именами)
create or replace function public.get_my_family()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  fam record;
  mems json;
begin
  select f.id, f.name, f.invite_code, f.owner_id, f.created_at
  into fam
  from public.families f
  join public.family_members m on m.family_id = f.id
  where m.user_id = auth.uid()
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(json_agg(json_build_object(
    'user_id', m.user_id,
    'role', m.role,
    'full_name', coalesce(p.full_name, ''),
    'email', coalesce(p.email, ''),
    'joined_at', m.joined_at
  )), '[]'::json)
  into mems
  from public.family_members m
  left join public.profiles p on p.id = m.user_id
  where m.family_id = fam.id;

  return json_build_object(
    'id', fam.id,
    'name', fam.name,
    'invite_code', fam.invite_code,
    'owner_id', fam.owner_id,
    'created_at', fam.created_at,
    'members', mems
  );
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_advice enable row level security;

drop policy if exists "families_select" on public.families;
create policy "families_select" on public.families
  for select using (id = public.my_family_id(auth.uid()));

drop policy if exists "family_members_select" on public.family_members;
create policy "family_members_select" on public.family_members
  for select using (family_id = public.my_family_id(auth.uid()));

drop policy if exists "family_advice_select" on public.family_advice;
create policy "family_advice_select" on public.family_advice
  for select using (family_id = public.my_family_id(auth.uid()));

drop policy if exists "family_advice_insert" on public.family_advice;
create policy "family_advice_insert" on public.family_advice
  for insert with check (family_id = public.my_family_id(auth.uid()));

-- ============================================================================
-- Обновляем RLS дневника: общий доступ + владелец вносит за других
-- ============================================================================
drop policy if exists "meal_entries_select_own" on public.meal_entries;
drop policy if exists "meal_entries_insert_own" on public.meal_entries;
drop policy if exists "meal_entries_delete_own" on public.meal_entries;
drop policy if exists "meal_entries_update_own" on public.meal_entries;

-- видеть: свои + записи членов своей семьи
create policy "meal_entries_select_family" on public.meal_entries
  for select using (
    auth.uid() = user_id
    or public.is_same_family(auth.uid(), user_id)
  );

-- добавлять: за себя или (владелец) за члена своей семьи
create policy "meal_entries_insert_family" on public.meal_entries
  for insert with check (
    auth.uid() = user_id
    or (public.is_family_owner(auth.uid()) and public.is_same_family(auth.uid(), user_id))
  );

create policy "meal_entries_delete_family" on public.meal_entries
  for delete using (
    auth.uid() = user_id
    or (public.is_family_owner(auth.uid()) and public.is_same_family(auth.uid(), user_id))
  );

create policy "meal_entries_update_family" on public.meal_entries
  for update using (
    auth.uid() = user_id
    or (public.is_family_owner(auth.uid()) and public.is_same_family(auth.uid(), user_id))
  );
