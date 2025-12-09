-- Equipment calibration tables and helpers (thermometers + future devices)

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  label_code text not null default ('EQ-' || substring(md5(random()::text), 1, 8)),
  name text not null,
  type text not null default 'thermometer',
  model text,
  serial_number text,
  location text,
  status text not null default 'active' check (status in ('active', 'out_of_service', 'retired')),
  calibration_interval_days integer not null default 30 check (calibration_interval_days > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists equipment_label_code_idx on public.equipment (label_code);
create index if not exists equipment_status_idx on public.equipment (status);

create table if not exists public.equipment_calibrations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  performed_at timestamptz not null default now(),
  performed_by text,
  method text,
  reference_ice_c numeric,
  reference_boiling_c numeric,
  observed_ice_c numeric,
  observed_boiling_c numeric,
  adjustment text,
  result text,
  notes text,
  next_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists equipment_calibrations_equipment_id_idx on public.equipment_calibrations (equipment_id);
create index if not exists equipment_calibrations_performed_at_idx on public.equipment_calibrations (performed_at desc);

create or replace function public.equipment_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_equipment_set_updated_at on public.equipment;
create trigger trg_equipment_set_updated_at
before update on public.equipment
for each row execute procedure public.equipment_set_updated_at();

create or replace view public.equipment_latest_calibration as
select
  e.*,
  c.id as latest_calibration_id,
  c.performed_at as latest_calibrated_at,
  c.result as latest_calibration_result,
  c.next_due_at as latest_calibration_due_at,
  c.observed_ice_c,
  c.observed_boiling_c,
  c.adjustment
from public.equipment e
left join lateral (
  select *
  from public.equipment_calibrations c
  where c.equipment_id = e.id
  order by c.performed_at desc
  limit 1
 ) c on true;

