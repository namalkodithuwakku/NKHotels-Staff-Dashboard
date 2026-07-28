# NKH Premium UI Release

## Included

- Plus Jakarta Sans throughout the dashboard.
- White-first premium palette with controlled navy, cobalt, jungle green and NKH amber.
- Explicit five-region task-card grid to prevent button overlap.
- Properly sized Acknowledge button and compact Done button.
- One-click optimistic Done and Acknowledge actions.
- Immediate task removal and immediate sidebar-counter reduction.
- Background task events, WhatsApp task links and WhatsApp completion confirmation.
- Large, short completion encouragement animation with urgent and queue-cleared variants.
- Premium navigation, top-bar status controls, Home metrics, Roster, Properties, WhatsApp, SMS and modal styling.
- Server-backed task notification counts for Team and Master dashboards.
- Create Task only; Create & Start has been removed.
- Responsive desktop, tablet and mobile rules.
- Reduced-motion accessibility support.

## Install

Copy the included `app` folder over the existing project and allow matching files to be replaced.
No SQL migration or new environment variable is required.

Run:

```powershell
npm run build
git add app
git commit -m "Install NKH premium UI and instant task workflow"
git push origin main
```

After Vercel reports Ready, use Ctrl+Shift+R once to clear the old cached CSS.
