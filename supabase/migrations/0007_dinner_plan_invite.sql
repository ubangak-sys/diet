-- ============================================================================
-- «Рацион+» — план ужинов (JSON) + ротация кода-приглашения
-- Выполнить в SQL Editor после 0006
-- ============================================================================

-- 1. Структурированный план ужинов (парсится Edge Function из ответа ИИ)
alter table public.family_advice
  add column if not exists plan jsonb;

-- 2. Ротация кода-приглашения (только владелец)
create or replace function public.rotate_invite_code(new_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare fid uuid; code text;
begin
  select family_id into fid from public.family_members
  where user_id = auth.uid() and role = 'owner';
  if fid is null then raise exception 'Только владелец может менять код'; end if;

  code := upper(new_code);
  if exists (select 1 from public.families where invite_code = code) then
    raise exception 'Такой код уже занят, попробуйте ещё раз';
  end if;

  update public.families set invite_code = code where id = fid;
  return code;
end;
$$;
