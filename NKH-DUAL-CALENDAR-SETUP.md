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
- Month selection and seven-day navigation are separate.
- Vertical zoom changes room-row height without shrinking date columns.
- Fullscreen mode is available.
- Reservation details show all stored guest, stay, contact, occupancy, payment,
  reference, note and audit information.
