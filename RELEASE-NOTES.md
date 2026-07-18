# N K Hotel OS Staff Dashboard Refurbishment

## Included in this release

- Five-area staff navigation: Home, Shift Tasks, Email Inbox, WhatsApp Inbox and Scheduled Tasks.
- Calm Home screen with shift status, four workload counts, exceptions and Continue Working.
- Shift Tasks separated from communications, with Open/In Progress/Done views and existing Start/Done actions.
- Gmail-style Email Inbox with compact list, detail preview, AI summary, original body, Gmail link, Ignore and Create & Start Task.
- Universal Task Creator using the existing property, create-task and task-status APIs.
- WhatsApp workspace entry using `NEXT_PUBLIC_WHATSAPP_INBOX_URL` (defaults to `https://nkhinbox.vercel.app`).
- Scheduled Tasks shell with due-date views, ready for the verified scheduler data contract.
- Responsive mobile list-to-detail email flow, sticky actions and five-item bottom navigation.
- Existing Shift, Super, task, email and WhatsApp intake API routes preserved.

## Safe boundaries

- Gmail remains the source of truth; no Gmail deletion or archive behavior was added.
- Scheduled recurrence and automatic due-task transfer were not invented in the frontend. Connect them after duplicate protection is verified in the backend.
- Full WhatsApp conversation embedding requires a conversation-list API from the separate WhatsApp Inbox project. Current WhatsApp task intake remains unchanged.

## Verification

- Production build completed successfully with Next.js 16.2.6.
- All 25 application routes compiled and generated.
- Existing project-wide ESLint debt remains in legacy files; it is outside this UI refurbishment and does not block the production build.
