-- ============================================================================
-- «Рацион+» — рекомендация по ужину + роли членов семьи + возраст
-- Выполнить в SQL Editor после 0002_family.sql
-- ============================================================================

-- 1. Возраст пользователя в профиле
alter table public.profiles add column if not exists age integer;

-- 2. Роль члена семьи: мама / папа / ребёнок
alter table public.family_members
  add column if not exists member_role text not null default 'kid'
  check (member_role in ('mom', 'dad', 'kid'));

-- 3. Триггер профиля: сохраняем и возраст из метаданных при регистрации
--    (триггер on_auth_user_created создан в 0001 и продолжает вызывать эту функцию)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, age)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'age' is not null
       and new.raw_user_meta_data->>'age' ~ '^[0-9]+$'
      then (new.raw_user_meta_data->>'age')::integer
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 4. create_family: принимает роль создателя
create or replace function public.create_family(fam_name text, fam_code text, fam_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if fam_role not in ('mom','dad','kid') then raise exception 'Неверная роль'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'Вы уже состоите в семье';
  end if;
  if exists (select 1 from public.families where invite_code = upper(fam_code)) then
    raise exception 'Такой код уже занят, попробуйте ещё раз';
  end if;

  insert into public.families (name, invite_code, owner_id)
  values (fam_name, upper(fam_code), auth.uid())
  returning id into fid;

  insert into public.family_members (family_id, user_id, role, member_role)
  values (fid, auth.uid(), 'owner', fam_role);

  return fid;
end;
$$;

-- 5. join_family: принимает роль вступающего
create or replace function public.join_family(fam_code text, fam_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if fam_role not in ('mom','dad','kid') then raise exception 'Неверная роль'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'Вы уже состоите в семье';
  end if;
  select id into fid from public.families where invite_code = upper(fam_code);
  if fid is null then raise exception 'Код не найден'; end if;

  insert into public.family_members (family_id, user_id, role, member_role)
  values (fid, auth.uid(), 'member', fam_role);

  return fid;
end;
$$;

-- 6. Смена роли: владелец — любому участнику, пользователь — себе
create or replace function public.set_family_role(target uuid, new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if new_role not in ('mom','dad','kid') then raise exception 'Неверная роль'; end if;

  if target = auth.uid() then
    update public.family_members set member_role = new_role where user_id = auth.uid();
  elsif exists (select 1 from public.family_members where user_id = auth.uid() and role = 'owner') then
    update public.family_members set member_role = new_role where user_id = target;
  else
    raise exception 'Нет прав менять роль';
  end if;
end;
$$;

-- 7. get_my_family: возвращаем роль и возраст участников
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
