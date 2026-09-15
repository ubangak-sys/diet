-- ============================================================================
-- «Рацион+» — остатки готовых блюд (быстрый ввод, учитываются при планировании)
-- Выполнить в SQL Editor после 0009
-- ============================================================================

create table if not exists public.leftovers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  dish text not null,
  amount text,
  cooked_on date,
  created_at timestamptz not null default now()
);

create index if not exists leftovers_family_idx on public.leftovers (family_id);

alter table public.leftovers enable row level security;

drop policy if exists "leftovers_select" on public.leftovers;
create policy "leftovers_select" on public.leftovers
  for select using (family_id = public.my_family_id(auth.uid()));

drop policy if exists "leftovers_insert" on public.leftovers;
create policy "leftovers_insert" on public.leftovers
  for insert with check (family_id = public.my_family_id(auth.uid()));

drop policy if exists "leftovers_delete" on public.leftovers;
create policy "leftovers_delete" on public.leftovers
  for delete using (family_id = public.my_family_id(auth.uid()));
