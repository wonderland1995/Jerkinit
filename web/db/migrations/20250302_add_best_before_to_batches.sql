-- Add an editable best-before date to batches
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'batches'
      and column_name = 'best_before_date'
  ) then
    alter table public.batches
      add column best_before_date date null;
  end if;
end $$;
