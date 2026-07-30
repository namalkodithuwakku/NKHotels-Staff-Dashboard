# NKH Competitor Analysis — installation

This update adds a Master-only, source-backed competitor research tool, exactly 10 prioritized recommendations and a downloadable management PDF.

## 1. Replace the project files

Extract the full package over the existing NKH Dashboard project. Allow matching files to be replaced. Do not delete `.env` files or Vercel environment variables.

## 2. Run the SQL migration

In Supabase → SQL Editor, run:

`supabase/migrations/20260730110000_competitor_analysis_reports.sql`

The migration is safe to run again.

If the OTA Promotions migration has not already been installed, run this first:

`supabase/migrations/20260730090000_ota_rate_profiles.sql`

## 3. Environment

No new required variable is needed. The tool uses the existing server-only `OPENAI_API_KEY`.

Optional:

`OPENAI_COMPETITOR_MODEL=gpt-5.4-mini`

## 4. Publish

```powershell
git add .
git commit -m "Add source-backed competitor analysis and PDF report"
git push origin main
```

Vercel will build and deploy from `main`.
