# NKH AI Supervisor Runtime

The Staff Dashboard exposes a private AI Supervisor API protected by `NKH_AI_SUPERVISOR_API_KEY`.

## Required Vercel environment variable

`NKH_AI_SUPERVISOR_API_KEY=<long-random-secret>`

Send it as:

`Authorization: Bearer <secret>`

## Endpoints

- `GET /api/supervisor/health` — runtime/Supabase health.
- `GET /api/supervisor/overview` — open, urgent, overdue, stale, unassigned tasks, private email queue count, active staff.
- `GET /api/supervisor/directory` — staff and property directory for assignment decisions.
- `GET /api/supervisor/email-queue` — private emails waiting for AI review.
- `POST /api/supervisor/email-resolve` — close an email after AI determines no staff action is required.
- `GET /api/supervisor/tasks` — query operational tasks; optional `status`, `assignedTo`, `property`, `limit`.
- `POST /api/supervisor/tasks/create` — create a normal operational task sourced as `AI Supervisor`.
- `POST /api/supervisor/tasks/update` — reassign, reprioritize, update notes, or change task status.

## Supervisor operating rules

1. Staff do not process email directly. Email is evidence for AI Supervisor only.
2. Create a task only when a clear operational action exists.
3. Use `sourceEmailId` when a task came from email so duplicate creation is blocked.
4. If no action is required, call `email-resolve` so the queue stays clean.
5. Prefer assignment to active on-shift staff when known. Otherwise leave unassigned for supervisor allocation.
6. Priority guidance: Critical = same-day guest/revenue risk; Urgent = next-day or severe OTA issue; High = time-sensitive; Normal = routine.
7. Re-check urgent/open tasks and escalate overdue work rather than creating duplicates.
8. Keep financial transactions, rate changes, booking deletion, user permissions, and outbound guest messaging outside autonomous scope until separate approval controls are added.

## Suggested cycle

`health -> overview -> email-queue -> directory -> create/resolve -> tasks -> update/escalate -> report`

All task mutations write `AI Supervisor` into the task event/audit trail.
