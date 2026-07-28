# NKH Dashboard — Niko Team Pet

Niko is a lightweight shared team mascot built directly into the dashboard. The artwork is inline SVG and CSS, so no image API, storage bucket, or new environment variable is required.

## Included

- Shared Niko mood, energy, happiness, and outfit stored in Supabase
- Three short pet interactions per staff member per day
- Pat, feed, and wave actions
- Master-only shared outfit selector
- Subtle celebrations after a completed task or correct hospitality answer
- Compact launcher on task, WhatsApp, and SMS screens
- Mobile-safe layout, reduced-motion support, and no sound

## Install

1. Open Supabase → SQL Editor.
2. Run `supabase/migrations/20260729012000_niko_team_pet.sql`.
3. Copy the packaged files into the dashboard project while preserving their folder paths.
4. Commit and push the update.

No Vercel environment variables need to be added.

## Git commands

```powershell
cd "E:\NK Labs\NKHotels-Staff-Dashboard"
git add app
git add supabase/migrations/20260729012000_niko_team_pet.sql
git add NKH-NIKO-PET-SETUP.md
git commit -m "Add Niko shared team pet"
git push origin main
```

## Notes

- Niko does not award points and is not tied to staff performance.
- Staff can interact three times per Colombo calendar day.
- Only Master users can change the accessory shown to the whole team.
- If the migration has not been run, the dashboard continues working; only Niko remains unavailable.
