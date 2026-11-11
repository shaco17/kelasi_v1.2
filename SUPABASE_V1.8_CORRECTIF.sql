-- KELASI v1.8 — correctif idempotent (SQL Editor Supabase).
-- À exécuter APRÈS SUPABASE_A_EXECUTER.sql, SUPABASE_SYNC_V1.4.sql et SUPABASE_DEPENSES_V1.6.sql.
-- Peut être relancé sans risque ; aucune donnée existante n'est supprimée.

-- 1) Versements : l'application accepte tout montant positif (avant : minimum 100 € côté base,
--    ce qui faisait échouer la synchronisation des petits versements).
alter table public.versements drop constraint if exists versements_amount_check;
alter table public.versements add constraint versements_amount_check check (amount > 0);

-- 2) Projets : échéance facultative utilisée par l'application.
alter table public.projets add column if not exists deadline date null;

-- 3) Dettes : table absente si SUPABASE_V1.2.sql avait échoué sur sa ligne « create table ».
create table if not exists public.dettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  total_amount numeric not null check (total_amount > 0),
  monthly_payment numeric not null check (monthly_payment > 0),
  first_payment_date date not null,
  already_paid numeric not null default 0 check (already_paid >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dettes enable row level security;
drop policy if exists "own dettes" on public.dettes;
create policy "own dettes" on public.dettes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Recharger le cache de schéma de l'API REST.
notify pgrst, 'reload schema';
