-- SBS Linear Progression — Supabase schema
-- Run this first in the Supabase SQL editor.

create table if not exists settings (
  id int primary key,
  rounding numeric not null default 2.5,
  units text not null default 'lbs',
  weeks int not null default 21,
  days_per_week int not null default 3,
  current_week int not null default 1,
  cycle int not null default 1
);

create table if not exists lifts (
  id serial primary key,
  name text unique not null,
  role text,
  max numeric not null,
  single_at8_pct numeric not null default 0.9,
  set_goal int not null default 3,
  adj jsonb not null,
  weekly_intensity jsonb not null,
  rep_targets jsonb not null,
  rir_targets jsonb not null,
  sort int
);

create table if not exists program_days (
  id serial primary key,
  variant int not null,
  day int not null,
  position int not null,
  lift_id int references lifts(id) on delete cascade,
  unique(variant, day, position)
);

create table if not exists logs (
  id serial primary key,
  cycle int not null default 1,
  variant int not null,
  week int not null,
  day int not null,
  lift_id int references lifts(id) on delete cascade,
  sets_completed numeric,
  rir_last_set numeric,
  single_at8 numeric,
  video text,
  notes text,
  updated_at timestamptz default now(),
  unique(cycle, variant, week, day, lift_id)
);

create table if not exists accessories (
  id serial primary key,
  cycle int not null default 1,
  variant int not null,
  week int not null,
  day int not null,
  slot int not null,
  name text,
  weight numeric,
  reps_per_set numeric,
  rir_target numeric,
  set_goal numeric,
  sets_completed numeric,
  rir_last_set numeric,
  video text,
  notes text,
  updated_at timestamptz default now(),
  unique(cycle, variant, week, day, slot)
);

create table if not exists cycles (
  cycle int primary key,
  maxes jsonb not null,
  ended_at timestamptz default now()
);

-- Single-user app: permissive access for the anon key.
-- Anyone holding your anon key + URL can read/write this data, so don't share them publicly
-- beyond the app config in your own browser.
alter table settings enable row level security;
alter table lifts enable row level security;
alter table program_days enable row level security;
alter table logs enable row level security;
alter table accessories enable row level security;
alter table cycles enable row level security;

drop policy if exists anon_all on settings;
drop policy if exists anon_all on lifts;
drop policy if exists anon_all on program_days;
drop policy if exists anon_all on logs;
drop policy if exists anon_all on accessories;
drop policy if exists anon_all on cycles;

create policy anon_all on settings for all using (true) with check (true);
create policy anon_all on lifts for all using (true) with check (true);
create policy anon_all on program_days for all using (true) with check (true);
create policy anon_all on logs for all using (true) with check (true);
create policy anon_all on accessories for all using (true) with check (true);
create policy anon_all on cycles for all using (true) with check (true);
