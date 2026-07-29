# NKH Reservation Audit — setup

This update adds a Master-only **NKH Tools** page with:

- OTA Booking Audit
- AI Revenue Planner
- A scalable internal tool selector for future tools

## 1. Paste the package

Copy the included `app` and `supabase` folders into the dashboard project root and allow matching files to be replaced.

## 2. Run the SQL once

In Supabase → SQL Editor, run:

`supabase/migrations/20260729070000_reservation_audit.sql`

This stores audit history and report findings. Uploaded OTA documents are not stored.

Then run:

`supabase/migrations/20260729071000_ai_revenue_planner.sql`

This stores generated advisory revenue plans. It does not change live rates.

## 3. Vercel variables

The existing `OPENAI_API_KEY` is used to read PDF, CSV and Excel exports.

Optional:

`OPENAI_OTA_AUDIT_MODEL=gpt-5.6-luna`

`OPENAI_REVENUE_MODEL=gpt-5.6-terra`

Redeploy after changing Vercel variables.

## 4. First test

1. Sign in as Master.
2. Open **NKH Tools**.
3. Select one property and the correct OTA.
4. Upload one OTA reservation export for a known date range.
5. Run the audit.
6. Check Matched, Different, Missing in Dashboard and Missing in OTA.
7. Download the CSV report.

For best calibration, retain one Booking.com, Agoda, Expedia and Airbnb sample whose correct result is already known.
