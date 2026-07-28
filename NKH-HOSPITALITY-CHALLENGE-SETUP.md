# NKH Hospitality Knowledge Challenge

## Included

- 144 curated questions across 12 hospitality categories
- 10 deterministic random questions per staff member per Colombo day
- Easy, Medium and Advanced scoring: 10, 20 and 30 points
- Server-side answer and score validation
- Daily team knowledge board
- Personal progress and recent learning
- Desktop, tablet and mobile UI
- Automatic one-time catalogue seeding
- Supabase image library and gradual daily image creation
- Premium category artwork while an individual image is still being prepared

The challenge is intentionally separate from task, roster, attendance and performance data.

## Installation order

1. In Supabase SQL Editor, run:

   `supabase/migrations/20260729010000_team_break.sql`

2. Copy the supplied `app` folder and `vercel.json` into the dashboard repository, preserving paths.

3. In Vercel Production environment variables, confirm:

   - `OPENAI_API_KEY` already exists
   - Add `CRON_SECRET` with a new long random secret
   - Optional: `TEAM_BREAK_IMAGES_PER_DAY=20`
   - Optional: `OPENAI_TEAM_BREAK_IMAGE_MODEL=gpt-image-1-mini`

4. Push to GitHub and wait for Vercel to become Ready.

5. Sign in and open **Team Break**. The first request automatically seeds the curated catalogue.

## Image schedule

The Vercel cron runs once daily at `22:35 UTC` (`04:05 Asia/Colombo`) and prepares twenty low-quality 1024 × 1024 images by default.
Set `TEAM_BREAK_IMAGES_PER_DAY` between 1 and 20 to change the daily batch.

Questions work immediately before all images are generated. Daily selection prioritises questions whose individual images are already ready.
