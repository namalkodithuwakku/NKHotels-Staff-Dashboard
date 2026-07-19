# N K Hotels WhatsApp Inbox

Standalone Next.js inbox module for the N K Hotels marketing team. The interface currently runs with demo conversations while the Meta WhatsApp Cloud API credentials and production message database remain disconnected.

## Local development

```bash
npm install
npm run dev
```

## Required Vercel environment variables

```text
WHATSAPP_VERIFY_TOKEN
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
```

Do not place live Meta credentials in the repository. Add them through Vercel Project Settings → Environment Variables.

## Meta webhook

After deployment, use this callback URL in the Meta developer app:

```text
https://YOUR-VERCEL-DOMAIN/api/whatsapp/webhook
```

The verification token must match `WHATSAPP_VERIFY_TOKEN` in Vercel.
