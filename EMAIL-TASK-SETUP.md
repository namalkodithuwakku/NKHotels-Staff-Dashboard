# NKH Email-to-Task setup

## 1. Supabase

Run `supabase/migrations/202607280001_email_task_learning.sql` once in the Supabase SQL Editor.

## 2. Vercel

Add these Production environment variables:

- `EMAIL_TASK_INTEGRATION_SECRET`: create a long random secret.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after saving them.

## 3. Apps Script

Copy `apps-script/NKH_Email_Task_Engine.gs` into the Apps Script project attached to the reservations Gmail account.

Add Script Properties:

- `NKH_EMAIL_TASK_ENDPOINT` = `https://YOUR-DASHBOARD.vercel.app/api/integrations/email/tasks`
- `NKH_EMAIL_TASK_SECRET` = the exact same value as `EMAIL_TASK_INTEGRATION_SECRET`

Delete the previous Gmail triggers, then run `installNKHEmailTaskTrigger()` once and approve access.
It establishes a baseline and checks every 10 minutes from 06:00 until 22:00 Asia/Colombo.

Run `testNKHEmailTaskEngineReadOnly()` to inspect the pending count, then send a new test email and run
`runNKHEmailTaskEngine()` once. The new task should appear in Shift Tasks.

## Learning behavior

All new Inbox emails become tasks. Staff can Ignore one or multiple email tasks and give a reason.
After the same normalized sender and subject pattern is ignored three times, matching future messages
are automatically ignored. Booking, cancellation, modification, guest-message, payment, availability,
complaint and urgent messages always bypass learned ignore rules.
