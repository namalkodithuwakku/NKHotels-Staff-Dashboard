# NKH Dual-Mode Calendar Setup

## Included modes

- **Google Sheet ON** — existing Sheet calendar remains read-only and continues syncing.
- **Google Sheet OFF** — rooms are generated from Property Profile → Room Types and bookings are managed directly in Supabase.

## Install

1. Extract this ZIP into the root of `NKHotels-Staff-Dashboard` and replace matching files.
2. Run this migration in Supabase SQL Editor:
   `supabase/migrations/20260729060000_dual_mode_calendar.sql`
   If you already ran the earlier dual-calendar migration, also run:
   `supabase/migrations/20260729061000_room_type_room_names.sql`
   Then run the operational calendar upgrade:
   `supabase/migrations/20260729062000_calendar_operations.sql`
3. Push the project:

```powershell
git add .
git commit -m "Add dual mode property calendars and booking management"
git push origin main
```

4. Wait for the Vercel production deployment to finish.

## Use

1. Open **Properties → Room Types**.
2. Add each room type and its number of physical rooms.
   Enter every individual room name or number on a separate line, for example:
   `101`, `102`, `103`.
3. Sign in with **Master** access.
4. Open **Properties → select the property → Overview**.
5. Use the **Google Sheet** switch in the **Calendar Source · Master Control** card.
5. Read the warning and confirm only when ready.

When Google Sheet is turned off, the old Sheet copy for that property is
replaced by rooms generated from the profile. Booking add, edit, and delete
become available. Turning Sheet mode back on disables booking editing; the next
Sheet sync replaces the Supabase calendar copy.

The calendar source switch is intentionally hidden from operational users.
Only a verified Master session can change it; the API enforces the same rule.

## Calendar workspace

- 42-day rolling view keeps Today in the centre and continues into next month.
- Month selection uses a consistent premium month grid with year navigation;
  seven-day navigation remains separate.
- Vertical zoom changes room-row height from approximately 30% to 160%
  without shrinking date columns.
- Fullscreen mode is available.
- Reservation details show all stored guest, stay, contact, occupancy, payment,
  reference, note and audit information.
- Click an available date cell to select a stay range; double-click a cell to
  open a one-night booking immediately.
- Use **Add booking** or **Block dates** from the selection bar.
- One reservation can allocate several rooms. Collision checks run before save.
- Drag a booking to another room on desktop. On mobile, hold the booking for
  about one second and then tap the destination room name.
- Room-status controls are retained in the backend but temporarily hidden from
  the calendar so the room rows stay compact.
- The selected property is remembered on that device. Superseded calendar
  requests are cancelled, and late responses are accepted only when both the
  property and visible date range still match. This prevents an older Sheet
  refresh from replacing the property currently being viewed.
- In Dashboard calendar mode, saving room types or individual room names
  immediately reconciles the calendar inventory. Existing saved profiles are
  also checked once in the background when their calendar opens. Active
  bookings follow safe room renames; rooms with active bookings are retained
  instead of being silently removed.
- Cancelling preserves operational history. Permanent deletion is restricted
  to Master access.

## Important mode rules

- Sheet mode is read-only. Its existing background refresh remains active.
- Dashboard mode writes directly to Supabase and does not write back to the
  Google Sheet.
- Never switch a live property away from Sheet mode until its room types,
  individual room names and counts have been checked.
