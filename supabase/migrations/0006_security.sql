-- ============================================================================
-- «Рацион+» — исправления прав и безопасности
-- Выполнить в SQL Editor после 0005
-- ============================================================================

-- 1. «Еду за других» вносят родители (мама/папа), а не только владелец.
--    Совпадает с логикой can_manage_child (родитель -> ребёнок той же семьи).
drop policy if exists "meal_entries_insert_family" on public.meal_entries;
drop policy if exists "meal_entries_delete_family" on public.meal_entries;
drop policy if exists "meal_entries_update_family" on public.meal_entries;

create policy "meal_entries_insert_family" on public.meal_entries
  for insert with check (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );

create policy "meal_entries_delete_family" on public.meal_entries
  for delete using (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );

create policy "meal_entries_update_family" on public.meal_entries
  for update using (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );

-- 2. Роль (мама/папа/ребёнок) ставит ТОЛЬКО владелец семьи.
--    (раньше участник мог сам себе сменить роль на «мама»)
create or replace function public.set_family_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if new_role not in ('mom','dad','kid') then raise exception 'Неверная роль'; end if;

  if not exists (
    select 1 from public.family_members
    where user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Только владелец семьи может менять роли';
  end if;

  update public.family_members set member_role = new_role where user_id = target;
end;
$$;

-- 3. Персональный совет: с клиента только чтение (запись — только Edge Function).
drop policy if exists "daily_advice_insert_own" on public.daily_advice;
drop policy if exists "daily_advice_update_own" on public.daily_advice;

-- 4. Семейная рекомендация: с клиента только чтение (запись — только Edge Function).
drop policy if exists "family_advice_insert" on public.family_advice;
