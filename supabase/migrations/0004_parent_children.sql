-- ============================================================================
-- «Рацион+» — родители (мама/папа) вносят и редактируют предпочтения детей
-- Выполнить в SQL Editor после 0003_dinner_roles.sql
-- ============================================================================

-- Вспомогательная функция: actor — родитель (мама/папа), target — ребёнок той же семьи
create or replace function public.can_manage_child(actor uuid, target uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.family_members a
    join public.family_members b on b.family_id = a.family_id
    where a.user_id = actor
      and a.member_role in ('mom','dad')
      and b.user_id = target
      and b.member_role = 'kid'
  );
$$;

-- Предпочтения: свои + (родитель) предпочтения детей
drop policy if exists "preferences_select_own" on public.preferences;
drop policy if exists "preferences_insert_own" on public.preferences;
drop policy if exists "preferences_update_own" on public.preferences;

create policy "preferences_select_own_or_child" on public.preferences
  for select using (auth.uid() = user_id or public.can_manage_child(auth.uid(), user_id));

create policy "preferences_insert_own_or_child" on public.preferences
  for insert with check (auth.uid() = user_id or public.can_manage_child(auth.uid(), user_id));

create policy "preferences_update_own_or_child" on public.preferences
  for update using (auth.uid() = user_id or public.can_manage_child(auth.uid(), user_id));

-- Профиль: родитель может читать и править профиль ребёнка (имя/возраст)
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own_or_child" on public.profiles
  for select using (auth.uid() = id or public.can_manage_child(auth.uid(), id));

create policy "profiles_update_own_or_child" on public.profiles
  for update using (auth.uid() = id or public.can_manage_child(auth.uid(), id));
