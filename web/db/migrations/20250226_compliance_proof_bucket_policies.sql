-- Ensure the compliance-proof bucket exists and is public
insert into storage.buckets (id, name, public)
values ('compliance-proof', 'compliance-proof', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- Allow anyone (anon or authenticated) to read from the bucket
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where policyname = 'Allow compliance-proof read'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance-proof read"
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'compliance-proof');
  end if;
end
$$;

-- Allow authenticated users (including service role) to upload
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where policyname = 'Allow compliance-proof insert'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance-proof insert"
      on storage.objects
      for insert
      to authenticated, service_role
      with check (bucket_id = 'compliance-proof');
  end if;
end
$$;

-- Allow service role to update objects in the bucket
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where policyname = 'Allow compliance-proof update'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance-proof update"
      on storage.objects
      for update
      to service_role
      using (bucket_id = 'compliance-proof')
      with check (bucket_id = 'compliance-proof');
  end if;
end
$$;

-- Allow service role to delete objects in the bucket
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where policyname = 'Allow compliance-proof delete'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy "Allow compliance-proof delete"
      on storage.objects
      for delete
      to service_role
      using (bucket_id = 'compliance-proof');
  end if;
end
$$;
