create table if not exists public.nkh_reservation_audit_events (
  id uuid primary key default gen_random_uuid(),
  email_inbox_id uuid not null references public.nkh_email_inbox(id) on delete cascade,
  gmail_message_id text not null,
  property_id uuid references public.nkh_properties(id) on delete set null,
  property_name text,
  ota_source text,
  event_type text not null check (event_type in ('New Booking','Modified Booking','Cancelled Booking')),
  booking_reference text,
  email_received_at timestamptz not null,
  due_at timestamptz not null,
  audit_status text not null default 'Waiting' check (audit_status in ('Waiting','Verified','Needs Staff Action','Unable to Match')),
  severity text not null default 'Normal' check (severity in ('Normal','High','Urgent')),
  match_confidence integer not null default 0,
  matched_booking_ids jsonb not null default '[]'::jsonb,
  expected_data jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_inbox_id)
);

create index if not exists nkh_reservation_audit_events_queue_idx
  on public.nkh_reservation_audit_events(audit_status, due_at);
create index if not exists nkh_reservation_audit_events_property_idx
  on public.nkh_reservation_audit_events(property_id, email_received_at desc);

alter table public.nkh_reservation_audit_events enable row level security;

drop trigger if exists nkh_reservation_audit_events_updated_at on public.nkh_reservation_audit_events;
create trigger nkh_reservation_audit_events_updated_at before update on public.nkh_reservation_audit_events
  for each row execute function public.nkh_set_updated_at();

comment on table public.nkh_reservation_audit_events is
  'Read-only live verification of OTA reservation emails against NKH calendar bookings.';
