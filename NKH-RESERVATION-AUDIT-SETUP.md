# NKH Reservation Audit — setup

This update adds a Master-only **Reservation Tools → OTA booking audit** page.

## 1. Paste the package

Copy the included `app` and `supabase` folders into the dashboard project root and allow matching files to be replaced.

## 2. Run the SQL once

In Supabase → SQL Editor, run:

`supabase/migrations/20260729070000_reservation_audit.sql`

This stores audit history and report findings. Uploaded OTA documents are not stored.

## 3. Vercel variables

The existing `OPENAI_API_KEY` is used to read PDF, CSV and Excel exports.

Optional:

`OPENAI_OTA_AUDIT_MODEL=gpt-5.6-luna`

Redeploy after changing Vercel variables.

## 4. First test

1. Sign in as Master.
2. Open **Reservation Tools**.
3. Select one property and the correct OTA.
4. Upload one OTA reservation export for a known date range.
5. Run the audit.
6. Check Matched, Different, Missing in Dashboard and Missing in OTA.
7. Download the CSV report.

For best calibration, retain one Booking.com, Agoda, Expedia and Airbnb sample whose correct result is already known.
