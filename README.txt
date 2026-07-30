NKH Academy - Sri Lankan Staff Visual Update

Included changes:
- Every new Academy image uses the Sri Lankan staff visual standard.
- Staff keep polished international Western hotel uniforms.
- Saved custom question prompts can no longer bypass the visual standard.
- Master receives a Replace visual button on existing images.
- Replaced images overwrite the existing storage object and refresh immediately.
- Team members cannot replace existing images.

Replace the included files using the same folder paths.

Then run:

git add app/api/cron/team-break-images/route.ts app/components/team-break/TeamBreakWorkspace.tsx app/components/team-break/AcademyAssignment.tsx app/dashboards/MasterDashboard.tsx app/styles/components/team-break.css
git commit -m "Use Sri Lankan hospitality staff in Academy visuals"
git push origin main

No SQL migration or new environment variable is required.
