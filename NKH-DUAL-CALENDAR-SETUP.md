# NKH Dual-Mode Calendar Setup

## Included modes

- **Google Sheet ON** — existing Sheet calendar remains read-only and continues syncing.
- **Google Sheet OFF** — rooms are generated from Property Profile → Room Types and bookings are managed directly in Supabase.

## Install

1. Extract this ZIP into the root of `NKHotels-Staff-Dashboard` and replace matching files.
2. Run this migration in Supabase SQL Editor:
   `supabase/migrations/20260729060000_dual_mode_calendar.sql`
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
3. Open **Calendars** and select the property.
4. Use the **Google Sheet** switch.
5. Read the warning and confirm only when ready.

When Google Sheet is turned off, the old Sheet copy for that property is
replaced by rooms generated from the profile. Booking add, edit, and delete
become available. Turning Sheet mode back on disables booking editing; the next
Sheet sync replaces the Supabase calendar copy.
