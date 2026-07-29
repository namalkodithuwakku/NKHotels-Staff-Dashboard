alter table public.nkh_calendar_bookings
  add column if not exists meal_plan text,
  add column if not exists payment_status text not null default 'Not paid',
  add column if not exists children_ages integer[] not null default '{}',
  add column if not exists voucher_sent boolean not null default false,
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists cancellation_reason text;

create table if not exists public.nkh_calendar_booking_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  booking_group_key text,
  booking_id uuid,
  event_type text not null,
  performed_by text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nkh_calendar_booking_events_group_idx
  on public.nkh_calendar_booking_events(property_id, booking_group_key, created_at desc);

alter table public.nkh_calendar_booking_events enable row level security;

comment on table public.nkh_calendar_booking_events is
  'Immutable operational history for dashboard-managed calendar reservations.';
