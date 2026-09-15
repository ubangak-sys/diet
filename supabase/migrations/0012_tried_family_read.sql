-- ============================================================================
-- «Рацион+» — вердикты: семейный просмотр (как дневник)
-- Выполнить в SQL Editor после 0011
-- ============================================================================

-- Чтение вердиктов — как общий дневник: члены семьи видят вердикты друг друга.
-- Запись остаётся только «себе» или «родитель -> ребёнок» (can_manage_child).
drop policy if exists "tried_foods_select_own" on public.tried_foods;
create policy "tried_foods_select_family" on public.tried_foods
  for select using (
    auth.uid() = user_id
    or public.is_same_family(auth.uid(), user_id)
  );
