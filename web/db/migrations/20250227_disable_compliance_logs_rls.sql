-- Ensure compliance log inserts aren't blocked in production
alter table public.compliance_logs disable row level security;
