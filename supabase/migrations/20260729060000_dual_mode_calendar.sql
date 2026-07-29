alter table public.nkh_properties
  add column if not exists calendar_source_mode text not null default 'google_sheet';

alter table public.nkh_properties
  drop constraint if exists nkh_properties_calendar_source_mode_check;
alter table public.nkh_properties
  add constraint nkh_properties_calendar_source_mode_check
  check (calendar_source_mode in ('google_sheet', 'supabase'));

alter table public.nkh_calendar_rooms
  add column if not exists room_type_id uuid references public.nkh_room_types(id) on delete set null;

alter table public.nkh_room_types
  add column if not exists room_names text[] not null default '{}';

alter table public.nkh_calendar_bookings
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists adults integer not null default 1,
  add column if not exists children integer not null default 0,
  add column if not exists total_amount numeric(12,2),
  add column if not exists received_amount numeric(12,2),
  add column if not exists currency_code text not null default 'LKR';

alter table public.nkh_calendar_bookings
  drop constraint if exists nkh_calendar_bookings_guest_counts_check;
alter table public.nkh_calendar_bookings
  add constraint nkh_calendar_bookings_guest_counts_check
  check (adults >= 0 and children >= 0);

create index if not exists nkh_calendar_rooms_type_idx
  on public.nkh_calendar_rooms(property_id, room_type_id);

comment on column public.nkh_properties.calendar_source_mode is
  'google_sheet keeps the calendar read-only; supabase enables dashboard-managed rooms and booking CRUD.';
