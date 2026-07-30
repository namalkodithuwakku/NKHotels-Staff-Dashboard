-- Revenue Manager historical snapshots.
-- This stores compact inventory observations only. It never changes live rates or OTA availability.
create table if not exists public.nkh_revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  inventory integer not null default 0,
  occupied_room_nights integer not null default 0,
  booked_revenue numeric(14,2) not null default 0,
  daily_inventory jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now(),
  constraint nkh_revenue_snapshot_period_check check (period_end >= period_start)
);

create index if not exists nkh_revenue_snapshots_lookup_idx
  on public.nkh_revenue_snapshots(property_id, period_start, period_end, captured_at desc);

alter table public.nkh_revenue_snapshots enable row level security;

comment on table public.nkh_revenue_snapshots is
  'Compact observations used to calculate 1, 3, 7 and 30-day booking pickup. Advisory only.';
