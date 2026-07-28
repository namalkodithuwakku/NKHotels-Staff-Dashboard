# NKH activity-aware SMS alerts

## Install order

1. Run `supabase/migrations/202607270001_presence_and_operational_alerts.sql` in the Supabase SQL Editor.
2. Deploy the dashboard code to Vercel.
3. Sign out and sign back in on each staff device.
4. Open **Master → Staff Profiles** to see Online, Away, Offline and last-seen time.

## Default rules

- Presence heartbeat: every 60 seconds.
- Alert evaluation while a dashboard is open: every 5 minutes.
- Online: visible heartbeat within 2 minutes.
- Away: hidden tab or last heartbeat 2–5 minutes ago.
- Offline: no heartbeat for more than 5 minutes.
- Staff SMS: current on-shift staff when a task waits over 10 minutes or the email queue exceeds 10.
- Namal/CEO SMS: a separate oversight summary for the same delayed-task and email-queue conditions.
- Shift start SMS: one message to the scheduled staff member and a separate update to Namal/Master.
- SMS repeat cooldown: 60 minutes.

Dialog credentials already used by SMS Center are reused. Staff and Master phone numbers come from **Staff Profiles**.

For guaranteed checks when every dashboard is closed, set `ALERT_CRON_SECRET` in Vercel and call:

`POST https://YOUR-DOMAIN/api/notifications/run`

with header:

`Authorization: Bearer YOUR_ALERT_CRON_SECRET`
