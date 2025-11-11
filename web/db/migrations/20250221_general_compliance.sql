-- General compliance tracking tables and seed data

create table if not exists public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  description text,
  frequency_type text not null check (frequency_type in ('weekly', 'fortnightly', 'monthly', 'batch_interval', 'custom')),
  frequency_value integer not null default 1,
  proof_required boolean not null default true,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_logs (
  id uuid primary key default gen_random_uuid(),
  compliance_task_id uuid not null references public.compliance_tasks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by text,
  result text,
  notes text,
  proof_url text,
  proof_filename text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists compliance_logs_task_id_idx on public.compliance_logs (compliance_task_id);
create index if not exists compliance_logs_completed_at_idx on public.compliance_logs (completed_at desc);

create or replace function public.compliance_tasks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_compliance_tasks_set_updated_at on public.compliance_tasks;
create trigger trg_compliance_tasks_set_updated_at
before update on public.compliance_tasks
for each row execute procedure public.compliance_tasks_set_updated_at();

insert into public.compliance_tasks (
  code,
  name,
  category,
  description,
  frequency_type,
  frequency_value,
  proof_required,
  metadata
) values
  (
    'ENV-FOOD-SWAB',
    'Listeria swab - food contact surfaces',
    'Environmental Monitoring',
    'Weekly environmental swabbing of all direct food contact surfaces as part of the prerequisite program.',
    'weekly',
    1,
    true,
    jsonb_build_object(
      'scope_label', 'Food contact surface(s)',
      'notes_hint', 'List benches, slicers, racks etc. that were swabbed'
    )
  ),
  (
    'ENV-NONFOOD-SWAB',
    'Listeria swab - non food contact surfaces',
    'Environmental Monitoring',
    'Fortnightly swabbing program focused on adjacent/non food contact areas to verify cleaning effectiveness.',
    'fortnightly',
    1,
    true,
    jsonb_build_object(
      'scope_label', 'Non food contact area(s)',
      'notes_hint', 'Walls, drains, conveyors, trolleys, etc.'
    )
  ),
  (
    'MICRO-LISTERIA',
    'Micro test - Listeria spp.',
    'Microbiological',
    'External lab micro testing scheduled every 10 finished batches.',
    'batch_interval',
    10,
    true,
    jsonb_build_object(
      'requires_batches', true,
      'result_label', 'Listeria result'
    )
  ),
  (
    'MICRO-ECOLI',
    'Micro test - E. coli',
    'Microbiological',
    'External lab micro testing scheduled every 10 finished batches.',
    'batch_interval',
    10,
    true,
    jsonb_build_object(
      'requires_batches', true,
      'result_label', 'E. coli result'
    )
  ),
  (
    'MICRO-SALMONELLA',
    'Micro test - Salmonella',
    'Microbiological',
    'External lab micro testing scheduled every 10 finished batches.',
    'batch_interval',
    10,
    true,
    jsonb_build_object(
      'requires_batches', true,
      'result_label', 'Salmonella result'
    )
  )
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  frequency_type = excluded.frequency_type,
  frequency_value = excluded.frequency_value,
  proof_required = excluded.proof_required,
  metadata = excluded.metadata,
  active = true;

insert into storage.buckets (id, name, public)
values ('compliance-proof', 'compliance-proof', true)
on conflict (id) do update
set public = excluded.public;
