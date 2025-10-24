-- Ensure recipe_ingredients supports cure metadata
alter table public.recipe_ingredients
  add column if not exists is_cure boolean default false,
  add column if not exists notes text;

-- Optional explicit cure type column if you'd like to persist alongside notes
alter table public.recipe_ingredients
  add column if not exists cure_type text;

-- Extend batch_ingredients with cure tracking
alter table public.batch_ingredients
  add column if not exists is_cure boolean default false,
  add column if not exists cure_required_grams numeric,
  add column if not exists cure_ppm numeric,
  add column if not exists cure_status text,
  add column if not exists cure_unit text;

-- Table to capture cure audit trail entries (auto-saves, manual overrides, etc.)
create table if not exists public.batch_cure_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  actual_amount numeric not null,
  unit text not null,
  cure_ppm numeric,
  cure_status text,
  recorded_by text,
  recorded_at timestamp with time zone not null default now(),
  metadata jsonb
);

create index if not exists batch_cure_audit_batch_id_idx on public.batch_cure_audit(batch_id);

