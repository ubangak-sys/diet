-- ============================================================================
-- «Рацион+» — фиксы прав и уникальность вердиктов
-- Выполнить в SQL Editor после 0010
-- ============================================================================

-- 1. set_family_role: target должен быть в семье владельца (защита от смены роли чужому uuid)
create or replace function public.set_family_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare owner_fam uuid;
begin
  if new_role not in ('mom','dad','kid') then raise exception 'Неверная роль'; end if;

  select family_id into owner_fam from public.family_members
  where user_id = auth.uid() and role = 'owner';
  if owner_fam is null then raise exception 'Только владелец семьи может менять роли'; end if;

  update public.family_members
  set member_role = new_role
  where user_id = target and family_id = owner_fam;
end;
$$;

-- 2. tried_foods: убираем дубликаты и делаем вердикт уникальным на (user_id, dish)
delete from public.tried_foods a
using public.tried_foods b
where a.user_id = b.user_id
  and a.dish = b.dish
  and a.created_at < b.created_at;

drop index if exists tried_foods_user_dish_unique;
create unique index if not exists tried_foods_user_dish_unique
  on public.tried_foods (user_id, dish);
