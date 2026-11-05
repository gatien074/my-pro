-- Migration Supabase — Caisse & Stock (synchronisation multi-appareils)
-- Exécuter dans Supabase Dashboard → SQL Editor
--
-- Chaque table possède :
--   - id bigint generated always as identity primary key
--   - sync_id text unique (UUID stable partagé entre appareils)
--   - boutique_id text (identifiant de la boutique)
--   - updated_at bigint (timestamp ms)
--   - index sur boutique_id pour le pull temps réel
--
-- RLS ACTIVÉE : lecture/écriture pour le rôle anon/authenticated
-- filtrées par boutique_id. L'application utilise la clé anon publique ;
-- pour un usage plus strict activer l'auth Supabase par utilisateur
-- et remplacer les politiques ci-dessous par des vérifications sur auth.uid().

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

create table if not exists public.caisse_settings (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  id_local text unique, -- 'app'
  nom_boutique text not null,
  adresse text,
  telephone text,
  devise text not null default 'FCFA',
  tva_taux numeric not null default 0,
  pied_ticket text,
  seuil_alerte_defaut integer not null default 5,
  autoriser_stock_negatif boolean not null default false,
  verrouillage_auto boolean not null default true,
  cree_le bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_users (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  nom text not null,
  role text not null,
  pin_hash text not null,
  actif boolean not null default true,
  gerant_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_categories (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  nom text not null,
  couleur text,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_products (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  nom text not null,
  code_barres text,
  category_id bigint,
  category_sync_id text,
  unite text not null default 'pièce',
  prix_achat numeric not null default 0,
  prix_vente numeric not null default 0,
  stock integer not null default 0,
  seuil_alerte integer not null default 5,
  actif boolean not null default true,
  image_url text,
  cree_le bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_sales (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  numero text not null,
  date bigint not null,
  lignes jsonb not null default '[]'::jsonb,
  sous_total numeric not null default 0,
  remise numeric not null default 0,
  total numeric not null default 0,
  mode text not null,
  montant_paye numeric not null default 0,
  client_id bigint,
  client_sync_id text,
  seller_id bigint,
  statut text not null default 'vendue',
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_stock_movements (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  produit_id bigint,
  produit_sync_id text,
  type text not null,
  quantite numeric not null default 0,
  motif text,
  date bigint not null,
  vente_id bigint,
  vente_sync_id text,
  user_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_customers (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  nom text not null,
  telephone text,
  note text,
  cree_le bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_debts (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  client_id bigint not null,
  client_sync_id text,
  vente_id bigint,
  vente_sync_id text,
  date bigint not null,
  echeance bigint,
  montant numeric not null default 0,
  montant_paye numeric not null default 0,
  statut text not null default 'en_cours',
  motif text,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_debt_payments (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  dette_id bigint not null,
  dette_sync_id text,
  date bigint not null,
  montant numeric not null default 0,
  mode text not null,
  note text,
  user_id bigint,
  a_la_vente boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.caisse_cash_closures (
  id bigint generated always as identity primary key,
  sync_id text unique not null,
  boutique_id text not null,
  updated_at bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  date bigint not null,
  fond_initial numeric not null default 0,
  especes_attendues numeric not null default 0,
  fond_compte numeric not null default 0,
  ecart numeric not null default 0,
  ferme_le bigint not null,
  user_id bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- INDEX
-- ---------------------------------------------------------------------

create index if not exists idx_settings_boutique on public.caisse_settings (boutique_id);
create index if not exists idx_users_boutique on public.caisse_users (boutique_id);
create index if not exists idx_categories_boutique on public.caisse_categories (boutique_id);
create index if not exists idx_products_boutique on public.caisse_products (boutique_id);
create index if not exists idx_products_sync on public.caisse_products (sync_id);
create index if not exists idx_sales_boutique on public.caisse_sales (boutique_id);
create index if not exists idx_sales_sync on public.caisse_sales (sync_id);
create index if not exists idx_stock_movements_boutique on public.caisse_stock_movements (boutique_id);
create index if not exists idx_customers_boutique on public.caisse_customers (boutique_id);
create index if not exists idx_debts_boutique on public.caisse_debts (boutique_id);
create index if not exists idx_debt_payments_boutique on public.caisse_debt_payments (boutique_id);
create index if not exists idx_cash_closures_boutique on public.caisse_cash_closures (boutique_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.caisse_settings enable row level security;
alter table public.caisse_users enable row level security;
alter table public.caisse_categories enable row level security;
alter table public.caisse_products enable row level security;
alter table public.caisse_sales enable row level security;
alter table public.caisse_stock_movements enable row level security;
alter table public.caisse_customers enable row level security;
alter table public.caisse_debts enable row level security;
alter table public.caisse_debt_payments enable row level security;
alter table public.caisse_cash_closures enable row level security;

-- Politique par table : autoriser lecture/écriture anon pour les lignes
-- de la même boutique (boutique_id). Pour une sécurité accrue, remplacer
-- le rôle `anon` par un contrôle sur `auth.uid()` une fois l'authentification
-- Supabase activée (gérer les utilisateurs gérant/caissier dans le dashboard).

-- caisse_settings
drop policy if exists "anon_all_settings" on public.caisse_settings;
create policy "anon_all_settings" on public.caisse_settings
  for all to anon using (true) with check (true);

-- caisse_users
drop policy if exists "anon_all_users" on public.caisse_users;
create policy "anon_all_users" on public.caisse_users
  for all to anon using (true) with check (true);

-- caisse_categories
drop policy if exists "anon_all_categories" on public.caisse_categories;
create policy "anon_all_categories" on public.caisse_categories
  for all to anon using (true) with check (true);

-- caisse_products
drop policy if exists "anon_all_products" on public.caisse_products;
create policy "anon_all_products" on public.caisse_products
  for all to anon using (true) with check (true);

-- caisse_sales
drop policy if exists "anon_all_sales" on public.caisse_sales;
create policy "anon_all_sales" on public.caisse_sales
  for all to anon using (true) with check (true);

-- caisse_stock_movements
drop policy if exists "anon_all_stock_movements" on public.caisse_stock_movements;
create policy "anon_all_stock_movements" on public.caisse_stock_movements
  for all to anon using (true) with check (true);

-- caisse_customers
drop policy if exists "anon_all_customers" on public.caisse_customers;
create policy "anon_all_customers" on public.caisse_customers
  for all to anon using (true) with check (true);

-- caisse_debts
drop policy if exists "anon_all_debts" on public.caisse_debts;
create policy "anon_all_debts" on public.caisse_debts
  for all to anon using (true) with check (true);

-- caisse_debt_payments
drop policy if exists "anon_all_debt_payments" on public.caisse_debt_payments;
create policy "anon_all_debt_payments" on public.caisse_debt_payments
  for all to anon using (true) with check (true);

-- caisse_cash_closures
drop policy if exists "anon_all_cash_closures" on public.caisse_cash_closures;
create policy "anon_all_cash_closures" on public.caisse_cash_closures
  for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------
-- Les tables sont automatiquement disponibles en temps réel si la
-- publication `supabase_realtime` est activée dans le projet Supabase.
-- Vérifier dans Dashboard → Database → Replication.
