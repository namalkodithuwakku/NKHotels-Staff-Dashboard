-- Editable OTA room rates imported from Master Work(1).xlsx / OTA Promotions.
-- Existing property, room and calendar data is not overwritten.
create table if not exists public.nkh_ota_rate_profiles (
 id uuid primary key default gen_random_uuid(), property_id uuid null references public.nkh_properties(id) on delete cascade,
 source_property_name text not null, source_variant smallint not null default 1 check(source_variant > 0), room_type_id uuid null references public.nkh_room_types(id) on delete set null, room_name text not null, meal_plan text not null default 'Room Only',
 rack_rate_usd numeric(12,2) not null default 0 check(rack_rate_usd>=0), commission_percent numeric(5,2) not null default 15 check(commission_percent between 0 and 100),
 genius_percent numeric(5,2) not null default 0 check(genius_percent between 0 and 100), audience_kind text not null default 'mobile' check(audience_kind in ('mobile','country')), audience_percent numeric(5,2) not null default 0 check(audience_percent between 0 and 100),
 campaign_kind text not null default 'getaway' check(campaign_kind in ('getaway','early_year')), campaign_percent numeric(5,2) not null default 0 check(campaign_percent between 0 and 100),
 deal_kind text not null default 'basic' check(deal_kind in ('basic','last_minute','early_booker')), deal_percent numeric(5,2) not null default 0 check(deal_percent between 0 and 100),
 limited_time_percent numeric(5,2) not null default 0 check(limited_time_percent between 0 and 100), needs_review boolean not null default true, notes text null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.nkh_ota_rate_profiles add column if not exists source_variant smallint not null default 1 check(source_variant > 0);
alter table public.nkh_ota_rate_profiles drop constraint if exists nkh_ota_rate_profiles_source_property_name_room_name_meal_plan_key;
create unique index if not exists nkh_ota_rate_profiles_source_variant_key on public.nkh_ota_rate_profiles(source_property_name,room_name,meal_plan,source_variant);
create index if not exists nkh_ota_rate_profiles_property_idx on public.nkh_ota_rate_profiles(property_id);
drop trigger if exists nkh_ota_rate_profiles_updated_at on public.nkh_ota_rate_profiles;
create trigger nkh_ota_rate_profiles_updated_at before update on public.nkh_ota_rate_profiles for each row execute function set_wa_updated_at();
with imported(source_property_name,room_name,meal_plan,rack_rate_usd,genius_percent,audience_percent,campaign_percent,deal_percent,limited_time_percent) as (values
  ('Queens Beach Hotel', 'Deluxe Family Room', 'BB', 120.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Family Room', 'RO', 90.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Double', 'BB', 84.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Double', 'RO', 76.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Triple', 'BB', 90.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Triple', 'RO', 80.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Twin', 'BB', 84.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Deluxe Twin', 'RO', 76.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Suite with Garden View', 'BB', 118.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Suite with Garden View', 'RO', 85.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Suite with Sea view', 'BB', 130.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Queens Beach Hotel', 'Suite with Sea view', 'RO', 100.0000, 10.0000, 10.0000, 30.0000, 15.0000, 0.0000),
  ('Kandy Casa', 'Superior Double Room', 'BB', 133.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Kandy Casa', 'Superior Family Room', 'BB', 180.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Kandy Casa', 'Superior Double Room with Bath Tub', 'BB', 142.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Palmera Eco Resort', 'Chalet', 'BB', 115.0000, 10.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Palmera Eco Resort', 'Double', 'BB', 95.0000, 10.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Palmera Eco Resort', 'Triple', 'BB', 100.0000, 10.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Varanya by Regus', 'Double room with garden view', 'BB', 135.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Varanya by Regus', 'Triple room with pool view', 'BB', 145.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Amandara Hills', 'Deluxe Double Room', 'RO', 80.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Amandara Hills', 'Deluxe Double Room', 'BB', 104.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Amandara Hills', 'Superior Double Room', 'RO', 99.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Amandara Hills', 'Superior Double Room', 'BB', 128.7000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Amandara Hills', 'Suite with mountain view', 'RO', 118.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Amandara Hills', 'Suite with mountain view', 'BB', 153.4000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Amandara Hills', 'Deluxe Villa', 'RO', 515.0000, 15.0000, 10.0000, 30.0000, 10.0000, 0.0000),
  ('Awesome Place', '1st floor', 'BB', 142.0000, 10.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Awesome Place', 'Ground floor', 'BB', 134.0000, 10.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Awesome Place', '2nd Floor', 'BB', 154.0000, 10.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Athkandura Hotel', 'Deluxe Double or Twin Room', 'RO', 80.0000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Athkandura Hotel', 'Deluxe Double or Twin Room', 'BB', 104.0000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Athkandura Hotel', 'Family Room with Balcony', 'RO', 125.0000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Athkandura Hotel', 'Triple Room with Balcony', 'RO', 94.0000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Athkandura Hotel', 'Triple Room with Balcony', 'BB', 122.2000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Eth Mansala', 'Three-Bedroom house', 'BB', 110.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Ronaya Surf Waves', 'Two-Bedroom Villa', 'RO', 250.0000, 15.0000, 10.0000, 20.0000, 10.0000, 0.0000),
  ('Villa Yuvin', 'Villa with Sea View', 'RO', 67.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Ceylon Beach Haven', 'Deluxe King Room', 'BB', 55.0000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Ceylon Beach Haven', 'Deluxe Queen Room', 'BB', 50.0000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Ceylon Beach Haven', 'Standard Queen', 'BB', 45.0000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Gagees Lake View Cabanas', 'Family Room with AC', 'BB', 140.0000, 10.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Gagees Lake View Cabanas', 'Family Room with Non AC', 'BB', 85.0000, 10.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Randon Resort', 'Deluxe Double Room', 'BB', 72.0000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Randon Resort', 'Deluxe Double Room', 'RO', 64.8000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Randon Resort', 'Deluxe Triple Room with Balcony', 'BB', 88.0000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Randon Resort', 'Deluxe Triple Room with Balcony', 'RO', 79.2000, 10.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Ravo Hotel', 'Deluxe Triple Room', 'RO', 126.0000, 15.0000, 10.0000, 30.0000, 5.0000, 0.0000),
  ('Ravo Hotel', 'Deluxe Triple Room', 'BB', 151.2000, 15.0000, 10.0000, 30.0000, 5.0000, 0.0000),
  ('Ravo Hotel', 'Deluxe Double Room', 'RO', 112.0000, 15.0000, 10.0000, 30.0000, 5.0000, 0.0000),
  ('Ravo Hotel', 'Deluxe Double Room', 'BB', 134.0000, 15.0000, 10.0000, 30.0000, 5.0000, 0.0000),
  ('Ravi Villa', 'Deluxe Apartment 01 - 02', 'RO', 80.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Ravi Villa', 'Apartment with Sea View 05', 'RO', 78.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Villa Mihindi', 'Deluxe Double Room 1', 'RO', 33.0000, 15.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Sheen Holiday Resort', 'Double', 'BB', 30.0000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Sheen Holiday Resort', 'Double', 'RO', 26.0000, 15.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Hasara Oceanfront', '2 bed apartment - Mr Jayasinghe', 'RO', 150.0000, 0.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Hasara Oceanfront', 'One Bed apartment 1.2', 'RO', 140.0000, 0.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Hasara Oceanfront', 'Three Bedroom Apartment 10.6, 6.9', 'RO', 326.0000, 0.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Hasara Oceanfront', '2-8 Ms Nadini 3BR apartment', 'RO', 354.0000, 0.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Hasara Oceanfront', '2 Br Mr Mahesh 4.9A', 'RO', 135.0000, 0.0000, 10.0000, 40.0000, 0.0000, 0.0000),
  ('Hasara Glenfall', 'Two Bedroom Apartment', 'RO', 120.0000, 0.0000, 10.0000, 25.0000, 0.0000, 0.0000),
  ('Cinnamon Estate Villa', 'Double Room', 'RO', 33.0000, 0.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Cinnamon Estate Villa', 'Triple Rooms', 'RO', 37.0000, 0.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Lavish Eco Jungle', 'Eco Double Room', 'BB', 38.0000, 20.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Lavish Eco Jungle', 'Eco Chalet Bungalow with Terrace', 'BB', 50.0000, 20.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Lavish Eco Jungle', 'Eco Family Room', 'BB', 50.0000, 20.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Lavish Eco Jungle', '3 Bedroom Bungalow', 'BB', 124.0000, 20.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Lavish Eco Jungle', 'Eco Double Room', 'BB', 31.0000, 20.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Tappers Village', 'Standard Double Room', 'RO', 32.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Tappers Village', 'Deluxe Triple Room', 'RO', 58.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Tappers Village', 'Deluxe Quadruple Room', 'RO', 75.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Tappers Village', 'Deluxe Family Suite', 'RO', 108.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Swarna Nature Villa', 'Deluxe Villa', 'RO', 51.0000, 0.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Swarna Nature Villa', 'Standard Villa', 'RO', 42.0000, 0.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Omer Villa', 'Deluxe Family Suite', 'RO', 84.0000, 0.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Omer Villa', 'Deluxe Double Room', 'RO', 66.0000, 0.0000, 10.0000, 0.0000, 0.0000, 0.0000),
  ('Gayani Villa', 'Three-Bedroom Villa', 'RO', 200.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Reluxmee Hotel Anuradapura', 'Deluxe Family Room', 'RO', 50.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Reluxmee Hotel Anuradapura', 'Standard Single Room', 'RO', 26.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Reluxmee Hotel Anuradapura', 'Deluxe Double Room', 'RO', 30.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Reluxmee Hotel Anuradapura', 'Deluxe Triple Room', 'RO', 40.0000, 0.0000, 10.0000, 30.0000, 0.0000, 0.0000),
  ('Serinity Lakefront Villa', 'Deluxe Triple Room', 'RO', 120.0000, 0.0000, 0.0000, 20.0000, 0.0000, 0.0000),
  ('Serinity Lakefront Villa', 'Standard Quadruple Room', 'RO', 121.0000, 0.0000, 0.0000, 20.0000, 0.0000, 0.0000),
  ('Serinity Lakefront Villa', 'Standard Family Room', 'RO', 147.0000, 0.0000, 0.0000, 20.0000, 0.0000, 0.0000),
  ('Serinity Lakefront Villa', 'Standard Twin Room', 'RO', 78.0000, 0.0000, 0.0000, 20.0000, 0.0000, 0.0000),
  ('Serinity Lakefront Villa', 'Standard Double Room', 'RO', 78.0000, 0.0000, 0.0000, 20.0000, 0.0000, 0.0000),
  ('Serinity Lakefront Villa', 'Standard Triple Room', 'RO', 95.0000, 0.0000, 0.0000, 20.0000, 0.0000, 0.0000),
  ('Grand Moon River', '701/703', 'BB', 130.0000, 0.0000, 10.0000, 20.0000, 0.0000, 0.0000),
  ('Grand Moon River', '707/708/709', 'BB', 150.0000, 0.0000, 10.0000, 20.0000, 0.0000, 0.0000),
  ('Grand Moon River', '705/710/711', 'BB', 169.0000, 0.0000, 10.0000, 20.0000, 0.0000, 0.0000),
  ('Grand Moon River', '702/704', 'BB', 129.0000, 0.0000, 10.0000, 20.0000, 0.0000, 0.0000),
  ('Grand Moon River', '706.0', 'BB', 169.0000, 0.0000, 10.0000, 20.0000, 0.0000, 0.0000)
), ranked as (
  select i.*,
    row_number() over(partition by lower(trim(source_property_name)),lower(trim(room_name)),lower(trim(meal_plan)) order by rack_rate_usd desc)::smallint source_variant,
    count(*) over(partition by lower(trim(source_property_name)),lower(trim(room_name)),lower(trim(meal_plan))) duplicate_count
  from imported i
), resolved as (
  select i.*,p.id property_id
  from ranked i
  left join public.nkh_properties p on regexp_replace(lower(trim(p.property_name)),'[^a-z0-9]+','','g')=regexp_replace(lower(trim(i.source_property_name)),'[^a-z0-9]+','','g')
)
insert into public.nkh_ota_rate_profiles(property_id,source_property_name,source_variant,room_name,meal_plan,rack_rate_usd,genius_percent,audience_percent,campaign_percent,deal_percent,limited_time_percent,needs_review,notes)
select property_id,source_property_name,source_variant,room_name,meal_plan,rack_rate_usd,genius_percent,audience_percent,campaign_percent,deal_percent,limited_time_percent,
  (property_id is null or rack_rate_usd=0 or duplicate_count>1),
  case
    when property_id is null then 'Property name did not match automatically. Select the correct hotel before use.'
    when duplicate_count>1 then 'The workbook contains multiple rates for this same room and meal plan. Both were preserved; verify which rate is current.'
    else 'Imported from Master Work OTA Promotions; verify ambiguous promotion type selectors.'
  end
from resolved
on conflict(source_property_name,room_name,meal_plan,source_variant) do update set property_id=coalesce(excluded.property_id,nkh_ota_rate_profiles.property_id),rack_rate_usd=excluded.rack_rate_usd,genius_percent=excluded.genius_percent,audience_percent=excluded.audience_percent,campaign_percent=excluded.campaign_percent,deal_percent=excluded.deal_percent,limited_time_percent=excluded.limited_time_percent,needs_review=excluded.needs_review,notes=excluded.notes,updated_at=now();

insert into public.nkh_ota_rate_profiles(property_id,source_property_name,room_name,meal_plan,rack_rate_usd,needs_review,notes)
select p.id,'Kandy Casa','Deluxe Double Room with Balcony','BB',0,true,'Rack rate was blank in Master Work. Add the correct USD rate before using this row.'
from (select 1) seed
left join public.nkh_properties p on regexp_replace(lower(trim(p.property_name)),'[^a-z0-9]+','','g')='kandycasa'
on conflict(source_property_name,room_name,meal_plan,source_variant) do nothing;
