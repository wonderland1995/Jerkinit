-- Lot and batch recall tracking

alter table public.lots
  add column if not exists recall_reason text,
  add column if not exists recall_notes text,
  add column if not exists recall_initiated_at timestamptz,
  add column if not exists recall_initiated_by text;

alter table public.batches
  add column if not exists recall_reason text,
  add column if not exists recall_notes text,
  add column if not exists recalled_at timestamptz;

create table if not exists public.lot_recalls (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  reason text not null,
  notes text,
  initiated_by text,
  initiated_at timestamptz not null default now(),
  email_body text,
  status text not null default 'open' check (status in ('open', 'resolved'))
);

create index if not exists lot_recalls_lot_id_idx on public.lot_recalls(lot_id);
create index if not exists lot_recalls_status_idx on public.lot_recalls(status);

create table if not exists public.lot_recall_batches (
  id uuid primary key default gen_random_uuid(),
  lot_recall_id uuid not null references public.lot_recalls(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(lot_recall_id, batch_id)
);

create index if not exists lot_recall_batches_batch_id_idx on public.lot_recall_batches(batch_id);
