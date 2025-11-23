-- Guarantee compliance log inserts aren't blocked by RLS
alter table if exists public.compliance_logs disable row level security;
alter table if exists public.compliance_logs no force row level security;

-- Drop any lingering policies that could force a failure
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'compliance_logs'
  loop
    execute format('drop policy if exists %I on public.compliance_logs', pol.policyname);
  end loop;
end;
$$;

-- Safety net: permissive policy so inserts succeed even if RLS is toggled back on
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'compliance_logs'
      and policyname = 'Allow compliance logs all'
  ) then
    create policy "Allow compliance logs all"
      on public.compliance_logs
      for all
      to public
      using (true)
      with check (true);
  end if;
end;
$$;

-- Ensure roles retain privileges even without RLS
grant all privileges on public.compliance_logs to anon, authenticated, service_role;
