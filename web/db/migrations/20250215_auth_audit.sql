-- User accounts for first-class authentication
create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  role text not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_role_check check (role in ('user', 'manager', 'admin'))
);

create unique index if not exists app_users_email_lower_idx on app_users (lower(email));

create or replace function app_users_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_set_updated_at on app_users;
create trigger trg_app_users_set_updated_at
before update on app_users
for each row execute procedure app_users_set_updated_at();

-- Centralized audit log
create table if not exists audit_logs (
  id bigserial primary key,
  user_id uuid references app_users(id),
  actor_email text,
  action text not null,
  resource text,
  resource_id text,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on audit_logs (user_id);
create index if not exists audit_logs_resource_idx on audit_logs (resource);
create index if not exists audit_logs_resource_id_idx on audit_logs (resource_id);
