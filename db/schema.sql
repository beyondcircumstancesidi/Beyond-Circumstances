-- Run this once in Supabase: your project -> SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
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

-- Anyone can create an account (this is what the sign-up page does).
create policy "anyone can insert an account"
  on accounts for insert
  with check (true);

-- A client can update a row if it knows that row's id (its own account,
-- kept in the browser after sign-up). Not real authentication - just
-- enough to let a signed-up student save their own Build progress
-- without a password. Reading the table back is NOT allowed here on
-- purpose, so account emails/phone numbers aren't publicly queryable -
-- the admin panel reads through a backend function instead (service
-- role key), never the public key used by this site's front end.
create policy "a client can update its own account row"
  on accounts for update
  using (true)
  with check (true);
