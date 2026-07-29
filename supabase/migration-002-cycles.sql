-- Migration: multi-cycle history (run once on an existing database)
alter table settings add column if not exists cycle int not null default 1;
alter table logs add column if not exists cycle int not null default 1;
alter table accessories add column if not exists cycle int not null default 1;

alter table logs drop constraint if exists logs_variant_week_day_lift_id_key;
alter table logs add constraint logs_cycle_variant_week_day_lift_id_key unique (cycle, variant, week, day, lift_id);
alter table accessories drop constraint if exists accessories_variant_week_day_slot_key;
alter table accessories add constraint accessories_cycle_variant_week_day_slot_key unique (cycle, variant, week, day, slot);

create table if not exists cycles (
  cycle int primary key,
  maxes jsonb not null,
  ended_at timestamptz default now()
);
alter table cycles enable row level security;
drop policy if exists anon_all on cycles;
create policy anon_all on cycles for all using (true) with check (true);
