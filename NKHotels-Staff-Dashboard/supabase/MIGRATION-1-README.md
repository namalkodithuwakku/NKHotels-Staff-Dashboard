# Migration 1: Property profiles and rates

This migration extends the existing `nkh_properties` table and adds the profile and rate-calendar tables used by the Staff Dashboard. It does not rename, delete, truncate, or update rows in any `wa_*` table.

## Apply

1. Back up the Supabase project from **Database → Backups** when that option is available on the current plan.
2. Open **SQL Editor → New query**.
3. Paste the complete contents of `migrations/202607180001_property_profiles_and_rates.sql`.
4. Click **Run** once and confirm that the result reports success.
5. In **Table Editor**, verify that the seven new `nkh_*` tables are present.

The script is idempotent for table/column creation and can be run again if execution is interrupted. Existing `nkh_properties` rows are preserved.

## Security model

RLS is enabled on every new table with no public browser policies. Migration 1 expects the Next.js server API to access these tables using the server-only `SUPABASE_SERVICE_ROLE_KEY`. Never use that key in a variable beginning with `NEXT_PUBLIC_`.

## Verification query

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'nkh_property_contacts',
    'nkh_room_types',
    'nkh_rate_plans',
    'nkh_rate_plan_prices',
    'nkh_rate_calendar_ranges',
    'nkh_property_policies',
    'nkh_property_faqs'
  )
order by table_name;
```

Expected result: seven rows.
