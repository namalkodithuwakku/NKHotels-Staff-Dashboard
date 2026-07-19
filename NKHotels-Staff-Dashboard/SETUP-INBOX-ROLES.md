# NKH Inbox ADMIN and TEAM setup

## 1. Supabase

Open Supabase **SQL Editor**, copy the contents of:

`supabase/inbox_roles_and_audit.sql`

Run it once. It creates only the Inbox deletion audit table and does not change existing messages, contacts, properties, or conversations.

## 2. Vercel environment variables

Open the Inbox project in Vercel, then go to **Settings → Environment Variables**.

Keep the existing `INBOX_SESSION_SECRET`. Add:

- `INBOX_ADMIN_PASSWORD` — private password for Namal/administrators
- `INBOX_TEAM_PASSWORD` — shared password for the Inbox team

Use different long passwords. Apply both variables to Production, Preview, and Development if those environments are used.

`INBOX_ACCESS_PASSWORD` is no longer used by the new login and may be removed after the new deployment works.

## 3. Deploy

Copy this package over the local GitHub project, then run:

```powershell
npm run build
git add .
git commit -m "Add admin and team inbox access"
git push origin main
```

The connected Vercel project will deploy automatically after the Git push.

## 4. Test

1. Sign in as TEAM and confirm messages, replies, notes, conversation updates, and contact editing work.
2. Confirm TEAM cannot see any delete button.
3. Sign out and sign in as ADMIN.
4. Confirm the ADMIN badge and delete controls appear.
5. Use a test conversation/property for the first deletion test.

Deleting a conversation permanently removes its messages and internal notes but keeps its contact/property. Deleting a property permanently removes that property, its linked contacts, conversations, messages, and notes.
