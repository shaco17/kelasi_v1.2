-- KELASI v1.6 — tables isolées pour le suivi Dépenses.
-- Migration additive et idempotente : ne modifie/supprime aucune donnée métier existante.
-- Exécuter dans Supabase SQL Editor. Les données structurées sont stockées dans data JSONB
-- afin de permettre l'évolution future du modèle sans migration destructive.

create table if not exists public.depenses_comptes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.depenses_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.depenses_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.depenses_recurrences (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.depenses_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare tbl text;
begin
  foreach tbl in array array['depenses_comptes','depenses_categories','depenses_transactions','depenses_recurrences','depenses_budgets'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists "own rows v1.6" on public.%I', tbl);
    execute format('create policy "own rows v1.6" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end $$;

-- Étend le registre durable V1.4 aux suppressions Dépenses.
-- Ne supprime aucune ligne de tombstone existante ; on remplace seulement le CHECK permissif.
alter table public.sync_tombstones drop constraint if exists sync_tombstones_table_name_check;
alter table public.sync_tombstones add constraint sync_tombstones_table_name_check
  check (table_name in ('versements','soldes_bancaires','projets','dettes','_meta',
    'depenses_comptes','depenses_categories','depenses_transactions','depenses_recurrences','depenses_budgets'));
