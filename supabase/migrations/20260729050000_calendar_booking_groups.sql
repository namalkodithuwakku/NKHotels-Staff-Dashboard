alter table public.nkh_calendar_bookings
  add column if not exists booking_group_key text;

update public.nkh_calendar_bookings
set booking_group_key = coalesce(
  nullif(booking_reference, ''),
  lower(
    regexp_replace(guest_name, '\s+', ' ', 'g') || '|' ||
    booking_source || '|' ||
    check_in::text || '|' ||
    check_out::text || '|' ||
    coalesce(notes, '')
  )
)
where booking_group_key is null;

create index if not exists nkh_calendar_bookings_group_idx
  on public.nkh_calendar_bookings(property_id, booking_group_key);

comment on column public.nkh_calendar_bookings.booking_group_key is
  'Groups multiple room allocations that belong to one logical reservation.';
