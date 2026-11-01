-- Migration: off-day workouts (push-ups, inner-thigh routine, activities). Run once.
-- Requires migration-003-auth.sql (uses public.is_owner()).

alter table settings add column if not exists offday_start date;          -- week 1 of the inner-thigh routine
alter table settings add column if not exists pushup_goal int not null default 100;

-- One row per entry, keyed by calendar date.
--   kind 'pushups'  : data {"sets": 6}                         (sets of 10; one row per date)
--   kind 'adductor' : data {"Butterfly":[10], "Kozak":[5], …}  (reps per set; one row per date)
--   kind 'activity' : data {"name":"Biking","minutes":45,"notes":"…"}  (any number per date)
create table if not exists offday_logs (
  id serial primary key,
  date date not null,
  kind text not null check (kind in ('pushups','adductor','activity')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
create index if not exists offday_logs_date_idx on offday_logs (date);

alter table offday_logs enable row level security;
drop policy if exists owner_all on offday_logs;
create policy owner_all on offday_logs for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Both the push-ups and the inner-thigh routine start the week of Nov 1, 2026.
update settings set offday_start = coalesce(offday_start, '2026-11-01') where id = 1;
