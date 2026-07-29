# NKH Academy — Automatic Assignments and Exams

## Included behavior

- Creates one Academy assignment on every scheduled working day.
- Staff can start at any time during that calendar day.
- The timer begins only when the staff member presses **Start**.
- Daily learning: 10 questions in 20 minutes.
- Monthly exam: 40 questions in 60 minutes.
- The exam is assigned on the staff member's final scheduled working day of the month.
- Master and Team dashboards include a live **Scheduled Tasks** page.
- Academy schedules are prepared from the roster through the end of the following month.
- Future lessons and exams remain in Scheduled Tasks and become Shift Tasks only on their scheduled date.
- Finishing the assignment automatically completes its linked dashboard task.
- The result sheet shows every question, the staff answer, the correct answer, and the explanation.
- Empty question visuals retain the manual **Generate image** action.
- Every desktop workspace uses a focused full-width layout with a slim left-center menu clip.
- Hovering over the clip slides the complete dashboard menu into view; moving away folds it automatically.
- The course library appears as a readable left-side navigator.
- Questions, definitions, answers, timers, and result sheets use a larger eye-friendly learning layout.

## Installation order

1. Copy the package contents into the root of `NKHotels-Staff-Dashboard`.
2. Open Supabase **SQL Editor**.
3. Run `supabase/migrations/20260729020000_academy_assignments.sql` once.
4. Commit and push:

```powershell
git add .
git commit -m "Add automatic Academy assignments exams and result sheets"
git push origin main
```

5. Wait for the Vercel production deployment to become **Ready**.
6. Keep the roster filled through the end of each month. The system uses the final scheduled workday to choose the monthly exam date.

## Notes

- No separate Vercel cron is required. The existing dashboard notification heartbeat safely runs the assignment scheduler.
- The Academy scheduler is isolated from operational alerts. A missing Academy table will not stop normal alerts, but assignments require the SQL migration.
- Existing Academy attempts and question data are preserved.
