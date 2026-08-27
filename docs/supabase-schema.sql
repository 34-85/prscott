-- PSMF Tracker — Supabase schema (Phase 1 sketch)
-- ---------------------------------------------------------------------------
-- Mirrors the app's local data model (see src/lib/types.ts) as a normalized,
-- per-user Postgres schema with Row-Level Security. Every row is owned by the
-- authenticated user; RLS makes cross-user access impossible at the database.
--
-- NOT stored server-side, on purpose:
--   • the Anthropic API key (BYOK) — stays in the device's localStorage only.
--   • derived totals / compliance scores — recomputed on the client from meals.
--
-- Apply in the Supabase SQL editor (or as a migration). Safe to re-run.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ── helper: keep updated_at fresh ──────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ── profiles: 1:1 with auth.users ──────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── settings: plan + per-day-type targets (1:1 with a user) ────────────────
-- Day-type profiles are a small config map, stored as JSONB rather than a
-- separate table (they're read/written as a whole).
create table if not exists public.settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  starting_weight     numeric,
  goal_loss           numeric,
  target_weeks        integer,
  meat_weights_default text default 'cooked',
  water_goal_oz       numeric default 128,
  day_profiles        jsonb  not null default '{}'::jsonb,  -- Record<DayType, DayProfile>
  ai_coach_enabled    boolean default false,
  ai_model            text,
  updated_at          timestamptz not null default now()
);

-- ── daily_logs: one row per user per date ──────────────────────────────────
create table if not exists public.daily_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  log_date       date not null,
  morning_weight numeric,
  weight_note    text,
  planned_type   text,               -- DayType | null
  water_oz       numeric,
  updated_at     timestamptz not null default now(),
  unique (user_id, log_date)
);
create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);

-- ── meals ──────────────────────────────────────────────────────────────────
create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  log_id       uuid not null references public.daily_logs (id) on delete cascade,
  eaten_at     timestamptz not null default now(),
  raw_text     text not null,
  parsed_foods jsonb not null default '[]'::jsonb,   -- FoodEstimate[]
  calories     numeric not null default 0,
  protein      numeric not null default 0,
  carbs        numeric not null default 0,
  fat          numeric not null default 0,
  confidence   text,                                 -- 'high' | 'medium' | 'low'
  notes        text,
  restaurant   jsonb,                                -- RestaurantInfo | null
  updated_at   timestamptz not null default now()
);
create index if not exists meals_log_idx on public.meals (log_id);
create index if not exists meals_user_idx on public.meals (user_id);

-- ── day_notes: free-form chat notes ────────────────────────────────────────
create table if not exists public.day_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_id     uuid not null references public.daily_logs (id) on delete cascade,
  noted_at   timestamptz not null default now(),
  text       text not null
);
create index if not exists day_notes_log_idx on public.day_notes (log_id);

-- ── custom_foods: personal library ─────────────────────────────────────────
create table if not exists public.custom_foods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  aliases        text[] not null default '{}',
  unit           text not null,
  serving_label  text,
  calories       numeric not null default 0,
  protein        numeric not null default 0,
  carbs          numeric not null default 0,
  fat            numeric not null default 0,
  fiber          numeric,
  priority       integer not null default 1,
  default_amount numeric,
  per_ounce      boolean default false,
  meat           boolean default false,
  portion_rules  jsonb,
  notes          text,
  updated_at     timestamptz not null default now()
);
create index if not exists custom_foods_user_idx on public.custom_foods (user_id);

-- ── updated_at triggers ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','settings','daily_logs','meals','custom_foods'] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$s;
       create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ── new-user bootstrap: create profile + settings rows on sign-up ──────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row-Level Security ─────────────────────────────────────────────────────
-- Every table: a user sees and writes only their own rows. profiles/settings
-- key on the user id column; the rest on user_id.
alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.daily_logs   enable row level security;
alter table public.meals        enable row level security;
alter table public.day_notes    enable row level security;
alter table public.custom_foods enable row level security;

-- profiles / settings (id / user_id == auth.uid())
create policy "own profile"  on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own settings" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- owned-by-user tables
do $$
declare t text;
begin
  foreach t in array array['daily_logs','meals','day_notes','custom_foods'] loop
    execute format(
      'create policy "own rows" on public.%1$s
         for all using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Sync strategy (client side, not SQL):
--   • Local-first: the app keeps working offline against localStorage.
--   • On first sign-in, migrate the existing localStorage AppState up (insert
--     settings, daily_logs, meals, notes, custom_foods for the user).
--   • Thereafter read/write Supabase with a local cache; last-write-wins by
--     updated_at is fine for a single-user-per-account tracker.
--   • Account deletion: delete the auth user → every table cascades. Export =
--     select all of the user's rows to JSON.
-- ---------------------------------------------------------------------------
