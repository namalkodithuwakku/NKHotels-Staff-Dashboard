# NKH OTA Promotions — installation

## Included

- 94 editable room/meal-plan rate rows from `Master Work(1).xlsx`.
- A new **OTA Rates** tab in every property profile.
- A new **OTA Promotions** tool in **NKH Tools**.
- Booking.com compatibility checks, sequential discount calculation, guest price, effective discount and estimated payout.
- No destructive updates to existing room types, calendars, bookings or rate plans.

## Install in this order

1. Extract this package over the dashboard repository and allow matching files to be replaced.
2. In Supabase **SQL Editor**, run:
   `supabase/migrations/20260730090000_ota_rate_profiles.sql`
3. Push the dashboard:

```powershell
git add .
git commit -m "Add editable OTA rate profiles and promotions simulator"
git push origin main
```

4. Wait for the Vercel deployment to show **Ready**.
5. Open **Properties → OTA Rates** and review imported values.
6. Open **NKH Tools → OTA Promotions** to simulate a room and meal plan.

## Review notes

- `Mobile Rate / Country`, `Getaway / Early Year`, and `Basic / Last minute / Early Booker` were combined columns in the workbook. The imported percentage is preserved, and the correct type is now editable.
- Kandy Casa → Deluxe Double Room with Balcony → BB had no rack rate in the workbook. It is imported as USD 0 and marked **Review**.
- Lavish Eco Jungle contains two BB rates for the same Eco Double Room (USD 38 and USD 31). Both are preserved as separate review rows instead of silently deleting one.
- The commission field defaults to 15% as an editable simulator assumption; verify it against the property’s Booking.com agreement.
- Rows whose hotel name does not match a property exactly are retained with a review note and are not silently attached to another hotel.
