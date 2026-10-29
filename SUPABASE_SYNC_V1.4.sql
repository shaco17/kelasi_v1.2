-- KELASI v1.4 : registre persistant des suppressions / marqueur d'initialisation.
-- À exécuter une fois dans Supabase SQL Editor avant de déployer le client v1.4.
create table if not exists public.sync_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null check (table_name in ('versements','soldes_bancaires','projets','dettes','_meta')),
  record_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, table_name, record_id)
);

alter table public.sync_tombstones enable row level security;
drop policy if exists "own sync tombstones" on public.sync_tombstones;
create policy "own sync tombstones" on public.sync_tombstones
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.sync_tombstones to authenticated;
