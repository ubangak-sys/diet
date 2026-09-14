-- ============================================================================
-- «Рацион+» — обратная связь по блюдам (попробовали / зашло / не зашло)
-- Выполнить в SQL Editor после 0007
-- ============================================================================

create table if not exists public.tried_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish text not null,
  verdict text not null check (verdict in ('liked', 'disliked')),
  created_at timestamptz not null default now()
);

create index if not exists tried_foods_user_dish_idx
  on public.tried_foods (user_id, dish);

alter table public.tried_foods enable row level security;

drop policy if exists "tried_foods_select_own" on public.tried_foods;
create policy "tried_foods_select_own" on public.tried_foods
  for select using (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );

drop policy if exists "tried_foods_insert_own" on public.tried_foods;
create policy "tried_foods_insert_own" on public.tried_foods
  for insert with check (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );

drop policy if exists "tried_foods_delete_own" on public.tried_foods;
create policy "tried_foods_delete_own" on public.tried_foods
  for delete using (
    auth.uid() = user_id
    or public.can_manage_child(auth.uid(), user_id)
  );
