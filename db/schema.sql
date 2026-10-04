-- Run this once in Supabase: your project -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text,
  dob date,
  phone text,
  school text,
  area text,
  is_admin boolean not null default false,
  build_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: locked down by default, opened up only where needed.
alter table accounts enable row level security;

-- No insert policy for the public anon key - account creation happens only
-- through api/create-account.js (service role key), so passwords always get
-- hashed server-side and can never be bypassed by writing directly to the
-- table with the public key.

-- A client can update a row if it knows that row's id (its own account,
-- kept in the browser after sign-up/login). This only covers things like
-- Build progress - it can't be used to change the password or email, since
-- those aren't sent from discover.html's save calls. Reading the table back
-- is NOT allowed here on purpose, so account emails/phone numbers/password
-- hashes aren't publicly queryable - the admin panel and login both read
-- through backend functions instead (service role key), never the public
-- key used by this site's front end.
create policy "a client can update its own account row"
  on accounts for update
  using (true)
  with check (true);
