-- Run this once in Supabase (SQL Editor -> New snippet -> paste -> Run).
-- Your accounts table already exists from before; this adds password
-- support to it without losing any existing data.

alter table accounts add column if not exists password_hash text;

-- Account creation now happens only through api/create-account.js (using
-- the service role key, which bypasses RLS entirely), so the public anon
-- key no longer needs - or should have - permission to insert rows
-- directly. Removing this closes the gap where someone could otherwise
-- create an account with no password by writing straight to the table.
drop policy if exists "anyone can insert an account" on accounts;
