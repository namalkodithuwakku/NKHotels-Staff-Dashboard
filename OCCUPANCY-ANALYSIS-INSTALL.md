# NKH Occupancy Analysis installation

1. Extract the full package over the current NKH Dashboard project.
2. In Supabase SQL Editor run:

`supabase/migrations/20260730120000_occupancy_analysis_reports.sql`

3. No new required Vercel variable is needed. It uses the existing `OPENAI_API_KEY` for optional recommendation refinement.
4. Publish:

```powershell
git add .
git commit -m "Add occupancy analysis tool and PDF"
git push origin main
```
