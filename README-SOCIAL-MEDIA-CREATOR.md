# NKH Social Media Creator

## Install

Extract this package into the root of `NKHotels-Staff-Dashboard` and allow the matching files to be replaced.

No SQL migration and no new Vercel environment variable are required. The tool reuses the existing `OPENAI_API_KEY`.

## Included

- Master-only Social Media Creator inside NKH Tools
- Active-property selector
- 15 hotel post types
- Objectives, tones, languages and three social post sizes
- Approved-content ingredients field
- Real hotel photo upload with preview and validation
- Property-aware AI caption, headline, CTA and hashtags
- Exact-text, photo-preserving PNG poster rendering
- Fact warnings for unsupported requests
- Copy caption and download PNG actions

## Push

```powershell
git add app/api/reservation-tools/social-media/route.ts app/components/reservation-tools/SocialMediaCreatorTool.tsx app/components/reservation-tools/ReservationToolsWorkspace.tsx app/styles/components/social-media-creator.css app/globals.css
git commit -m "Add property-aware social media creator"
git push origin main
```

Vercel should deploy automatically from `main`.
