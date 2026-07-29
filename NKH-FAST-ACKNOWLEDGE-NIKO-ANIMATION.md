# NKH Dashboard — Fast Acknowledge + Animated Niko

## Improvements

- Acknowledge removes one or many task cards immediately.
- Supabase status and email-learning updates continue silently in the background.
- The page is not refreshed or blocked.
- If the background update fails, the affected task is restored and an error is shown.
- Every task card shows its added date and time in Asia/Colombo time.
- Add Property and Edit Overview include a dedicated task identification email.
- The address is stored in `nkh_property_contacts` and is automatically used by the email-to-task engine.
- Duplicate identification emails across properties are rejected to avoid assigning tasks incorrectly.
- Property Contacts no longer require WhatsApp Inbox permission.
- WhatsApp Contacts still retain their separate channel-access restriction.
- Niko now has natural idle breathing, floating, blinking, ear and tail movement.
- Pat shows floating hearts.
- Feed animates a snack and Niko reaching for it.
- Wave animates Niko's trunk, ears, and greeting marks.
- Existing accessibility preference for reduced motion is preserved.

## Replace these files

- `app/components/tasks/ShiftTasks.tsx`
- `app/components/pet/NikoPet.tsx`
- `app/styles/components/niko-pet.css`
- `app/styles/nkh-premium-ui.css`
- `app/components/properties/PropertiesWorkspace.tsx`
- `app/api/property-profiles/route.ts`
- `app/api/property-profiles/[id]/route.ts`
- `app/lib/propertyIdentificationEmail.ts`
- `app/components/contacts/ContactManager.tsx`
- `app/api/whatsapp/contacts/route.ts`

No SQL migration or Vercel environment change is required.
