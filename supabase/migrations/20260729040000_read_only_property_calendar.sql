create table if not exists public.nkh_calendar_rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  source_key text not null,
  room_name text not null,
  room_type text,
  room_status text not null default 'Available',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, source_key)
);

create table if not exists public.nkh_calendar_bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  source_key text not null,
  booking_reference text,
  guest_name text not null,
  room_name text not null,
  room_type text,
  booking_source text not null default 'FIT',
  booking_status text not null default 'Confirmed',
  check_in date not null,
  check_out date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, source_key),
  constraint nkh_calendar_booking_dates_check check (check_out > check_in)
);

create table if not exists public.nkh_calendar_sync_state (
  property_id uuid primary key references public.nkh_properties(id) on delete cascade,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text not null default 'Pending',
  last_error text,
  rooms_synced integer not null default 0,
  bookings_synced integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists nkh_calendar_rooms_property_idx
  on public.nkh_calendar_rooms(property_id, sort_order);
create index if not exists nkh_calendar_bookings_property_dates_idx
  on public.nkh_calendar_bookings(property_id, check_in, check_out);

alter table public.nkh_calendar_rooms enable row level security;
alter table public.nkh_calendar_bookings enable row level security;
alter table public.nkh_calendar_sync_state enable row level security;

comment on table public.nkh_calendar_rooms is
  'Read-only room inventory copied from each property Google Sheet.';
comment on table public.nkh_calendar_bookings is
  'Read-only booking calendar copied from property Google Sheets.';
comment on table public.nkh_calendar_sync_state is
  'Last Google Sheet calendar sync result for each property.';
