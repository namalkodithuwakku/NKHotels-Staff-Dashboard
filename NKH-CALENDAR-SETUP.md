# NKH Dashboard — Read-only Property Calendar

## Included flow

Google property sheet → Apps Script copy → Supabase → NKH Dashboard.

The source Google Sheet remains read-only. The sync does not clear, edit,
format or recreate any source sheet.

## 1. Run the Supabase migrations in order

1. `supabase/migrations/20260729030000_property_calendar_sheet_code.sql`
2. `supabase/migrations/20260729040000_read_only_property_calendar.sql`
3. `supabase/migrations/20260729050000_calendar_booking_groups.sql`

## 2. Add the Vercel secret

Add this Production environment variable and redeploy:

`NKH_CALENDAR_SYNC_SECRET`

Use a long random value. Do not put this value in frontend code.

For instant cached loading plus a silent background source check, also add:

`NKH_CALENDAR_SCRIPT_URL`

Its value is the deployed Master Apps Script Web App `/exec` URL. After adding
the `doPost` handler from the calendar sync script, deploy a new Web App version
before copying this URL to Vercel.

## 3. Add the Apps Script

Copy `apps-script/NKH_Read_Only_Calendar_Sync.gs` into the central NKH Apps
Script project.

Add these Script Properties:

- `NKH_CALENDAR_SYNC_ENDPOINT`
  - `https://nkhdashboard.vercel.app/api/integrations/calendar/sync`
- `NKH_CALENDAR_SYNC_SECRET`
  - exactly the same value used in Vercel

Run `testNKHCalendarSyncReadOnly` once. It reads the first connected property
and reports the number of rooms and bookings without saving anything.

When the test is correct, run `runNKHCalendarSync` once. Then run
`installNKHCalendarSyncTrigger` to refresh the copied calendar every 10 minutes.

The dashboard always displays the Supabase copy first. When a user opens a
connected property calendar, it requests a new Google Sheet read in the
background and updates the calendar without refreshing the page. A shared
two-minute cooldown prevents multiple staff sessions from repeating the same
Google read.

## 4. Connect each property

Open Dashboard → Properties → Edit overview and paste the full Google Sheet URL
under **Google Calendar Sheet code or URL**. The dashboard stores only the
spreadsheet ID.

## Recognised source columns

The read-only scanner searches the first 12 rows of every sheet for common
headers:

- Room / Room No / Room Number / Unit
- Room Type / Category
- Guest / Guest Name / Customer
- Check In / Arrival
- Check Out / Departure
- Source / Channel / OTA
- Status / Booking Status
- Booking ID / Reservation ID / Reference
- Notes / Remarks

If the current booking sheet uses different headers or a visual calendar
matrix, the test safely reports that it could not match the structure. It will
not modify that sheet. In that case, add the actual Apps Script calendar reader
from the client portal so its response can be mapped exactly.

## Dashboard behaviour

- Calendars are available to Master, Supervisor and Team.
- The first connected property is selected automatically.
- The current month opens by default.
- Today and weekends are highlighted.
- Booking bars use source colours.
- Clicking a booking opens read-only details.
- Matching multi-room allocations remain visible on every room row but are
  counted and displayed as one logical booking.
- The last successful sync and any sync error are shown above the calendar.
