-- Create a fresh bucket for compliance proof uploads (mirrors the QA bucket approach)
insert into storage.buckets (id, name, public)
values ('compliance-proof-v2', 'compliance-proof-v2', true)
on conflict (id) do update
set public = excluded.public;

-- Allow anonymous + authenticated roles to read files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Allow compliance proof v2 read'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance proof v2 read"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'compliance-proof-v2');
  end if;
end
$$;

-- Allow authenticated users (and service role) to insert files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Allow compliance proof v2 insert'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance proof v2 insert"
      on storage.objects
      for insert
      to authenticated, service_role
      with check (bucket_id = 'compliance-proof-v2');
  end if;
end
$$;

-- Only the service role can update/delete files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Allow compliance proof v2 update'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance proof v2 update"
      on storage.objects
      for update
      to service_role
      using (bucket_id = 'compliance-proof-v2')
      with check (bucket_id = 'compliance-proof-v2');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Allow compliance proof v2 delete'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance proof v2 delete"
      on storage.objects
      for delete
      to service_role
      using (bucket_id = 'compliance-proof-v2');
  end if;
end
$$;
