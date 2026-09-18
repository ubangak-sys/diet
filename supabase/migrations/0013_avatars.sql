-- ============================================================================
-- «Рацион+» — аватарки (эмодзи + цвет фона)
-- Выполнить в SQL Editor после 0012
-- ============================================================================

alter table public.profiles add column if not exists avatar_emoji text;
alter table public.profiles add column if not exists avatar_color text;

-- get_my_family: возвращаем аватарки участников
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

  if not found then return null; end if;

  select coalesce(json_agg(json_build_object(
    'user_id', m.user_id,
    'role', m.role,
    'member_role', m.member_role,
    'full_name', coalesce(p.full_name, ''),
    'email', coalesce(p.email, ''),
    'age', p.age,
    'avatar_emoji', p.avatar_emoji,
    'avatar_color', p.avatar_color,
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
