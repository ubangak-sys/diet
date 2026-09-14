-- ============================================================================
-- «Рацион+» — синхронизация чекбоксов списка покупок (общая для семьи)
-- Выполнить в SQL Editor после 0008
-- ============================================================================

create or replace function public.toggle_shopping_item(p_advice uuid, p_index int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  fam uuid;
  items jsonb;
  item jsonb;
begin
  select family_id into fam from public.family_advice where id = p_advice;
  if fam is null then raise exception 'Совет не найден'; end if;
  if fam <> public.my_family_id(auth.uid()) then
    raise exception 'Нет доступа';
  end if;

  select plan->'shopping' into items from public.family_advice where id = p_advice;
  if items is null or jsonb_typeof(items) <> 'array' then
    return;
  end if;
  if p_index < 0 or p_index >= jsonb_array_length(items) then
    raise exception 'Неверный индекс';
  end if;

  item := items->p_index;
  if coalesce((item->>'checked')::boolean, false) then
    item := item - 'checked';
  else
    item := item || '{"checked": true}'::jsonb;
  end if;
  items := jsonb_set(items, array[p_index::text], item);

  update public.family_advice
  set plan = jsonb_set(plan, '{shopping}', items)
  where id = p_advice;
end;
$$;
