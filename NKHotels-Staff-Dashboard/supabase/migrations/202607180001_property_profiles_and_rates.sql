-- N K Hotels Staff Dashboard — Migration 1
-- Property profiles, rooms, approved FAQs and colour-coded rate calendar.
-- Safe to run more than once. Existing WhatsApp tables and records are not changed.

begin;

create extension if not exists pgcrypto;

create or replace function public.nkh_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Extend the existing WhatsApp property directory into the shared property profile.
alter table public.nkh_properties
  add column if not exists legal_name text,
  add column if not exists description text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists city text,
  add column if not exists country text not null default 'Sri Lanka',
  add column if not exists timezone text not null default 'Asia/Colombo',
  add column if not exists currency_code text not null default 'LKR',
  add column if not exists check_in_time time,
  add column if not exists check_out_time time,
  add column if not exists total_rooms integer,
  add column if not exists website_url text,
  add column if not exists map_url text,
  add column if not exists logo_url text,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.nkh_properties drop constraint if exists nkh_properties_client_status_check;
alter table public.nkh_properties add constraint nkh_properties_client_status_check
  check (client_status = any (array['Active', 'Lead', 'Onboarding', 'Former', 'Inactive']));

alter table public.nkh_properties drop constraint if exists nkh_properties_total_rooms_check;
alter table public.nkh_properties add constraint nkh_properties_total_rooms_check
  check (total_rooms is null or total_rooms >= 0);

create table if not exists public.nkh_property_contacts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  contact_type text not null default 'General',
  contact_name text not null,
  job_title text,
  email text,
  phone text,
  whatsapp_number text,
  sms_number text,
  preferred_channel text,
  is_primary boolean not null default false,
  is_emergency boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_property_contacts_channel_check check (
    preferred_channel is null or preferred_channel in ('Email', 'Phone', 'WhatsApp', 'SMS')
  ),
  constraint nkh_property_contacts_has_method_check check (
    email is not null or phone is not null or whatsapp_number is not null or sms_number is not null
  )
);

create table if not exists public.nkh_room_types (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  room_code text not null,
  room_name text not null,
  description text,
  room_count integer not null default 0,
  max_adults integer not null default 2,
  max_children integer not null default 0,
  max_occupancy integer not null default 2,
  bed_configuration text,
  amenities text[] not null default '{}',
  extra_bed_allowed boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, room_code),
  constraint nkh_room_types_counts_check check (
    room_count >= 0 and max_adults >= 0 and max_children >= 0 and max_occupancy > 0
  )
);

create table if not exists public.nkh_rate_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  plan_code text not null,
  plan_name text not null,
  color_hex text not null default '#E98A15',
  currency_code text not null default 'LKR',
  meal_plan text,
  is_refundable boolean not null default true,
  minimum_stay integer not null default 1,
  cancellation_terms text,
  internal_notes text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, plan_code),
  constraint nkh_rate_plans_color_check check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  constraint nkh_rate_plans_minimum_stay_check check (minimum_stay > 0)
);

create table if not exists public.nkh_rate_plan_prices (
  id uuid primary key default gen_random_uuid(),
  rate_plan_id uuid not null references public.nkh_rate_plans(id) on delete cascade,
  room_type_id uuid not null references public.nkh_room_types(id) on delete cascade,
  single_rate numeric(12,2),
  double_rate numeric(12,2),
  triple_rate numeric(12,2),
  extra_adult_rate numeric(12,2),
  extra_child_rate numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rate_plan_id, room_type_id),
  constraint nkh_rate_plan_prices_nonnegative_check check (
    coalesce(single_rate, 0) >= 0 and coalesce(double_rate, 0) >= 0 and
    coalesce(triple_rate, 0) >= 0 and coalesce(extra_adult_rate, 0) >= 0 and
    coalesce(extra_child_rate, 0) >= 0
  )
);

create table if not exists public.nkh_rate_calendar_ranges (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  rate_plan_id uuid not null references public.nkh_rate_plans(id) on delete cascade,
  room_type_id uuid references public.nkh_room_types(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  override_single_rate numeric(12,2),
  override_double_rate numeric(12,2),
  override_triple_rate numeric(12,2),
  minimum_stay_override integer,
  closed_to_arrival boolean not null default false,
  closed_to_departure boolean not null default false,
  is_closed boolean not null default false,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_rate_calendar_date_check check (end_date >= start_date),
  constraint nkh_rate_calendar_minimum_stay_check check (
    minimum_stay_override is null or minimum_stay_override > 0
  ),
  constraint nkh_rate_calendar_override_nonnegative_check check (
    coalesce(override_single_rate, 0) >= 0 and coalesce(override_double_rate, 0) >= 0 and
    coalesce(override_triple_rate, 0) >= 0
  )
);

create table if not exists public.nkh_property_policies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  policy_type text not null,
  title text not null,
  policy_text text not null,
  guest_facing boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nkh_property_faqs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  category text not null default 'General',
  question text not null,
  approved_answer text not null,
  guest_facing boolean not null default true,
  allowed_channels text[] not null default array['Email', 'WhatsApp', 'SMS'],
  is_active boolean not null default true,
  display_order integer not null default 0,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nkh_property_contacts_property_idx on public.nkh_property_contacts(property_id);
create index if not exists nkh_room_types_property_idx on public.nkh_room_types(property_id, is_active);
create index if not exists nkh_rate_plans_property_idx on public.nkh_rate_plans(property_id, is_active);
create index if not exists nkh_rate_plan_prices_plan_idx on public.nkh_rate_plan_prices(rate_plan_id);
create index if not exists nkh_rate_calendar_lookup_idx on public.nkh_rate_calendar_ranges(property_id, start_date, end_date);
create index if not exists nkh_property_policies_property_idx on public.nkh_property_policies(property_id, is_active);
create index if not exists nkh_property_faqs_property_idx on public.nkh_property_faqs(property_id, is_active);

drop trigger if exists nkh_property_contacts_updated_at on public.nkh_property_contacts;
create trigger nkh_property_contacts_updated_at before update on public.nkh_property_contacts for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_room_types_updated_at on public.nkh_room_types;
create trigger nkh_room_types_updated_at before update on public.nkh_room_types for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_rate_plans_updated_at on public.nkh_rate_plans;
create trigger nkh_rate_plans_updated_at before update on public.nkh_rate_plans for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_rate_plan_prices_updated_at on public.nkh_rate_plan_prices;
create trigger nkh_rate_plan_prices_updated_at before update on public.nkh_rate_plan_prices for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_rate_calendar_ranges_updated_at on public.nkh_rate_calendar_ranges;
create trigger nkh_rate_calendar_ranges_updated_at before update on public.nkh_rate_calendar_ranges for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_property_policies_updated_at on public.nkh_property_policies;
create trigger nkh_property_policies_updated_at before update on public.nkh_property_policies for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_property_faqs_updated_at on public.nkh_property_faqs;
create trigger nkh_property_faqs_updated_at before update on public.nkh_property_faqs for each row execute function public.nkh_set_updated_at();

-- All access is server-side for Migration 1. The browser receives data only through
-- protected dashboard API routes; no service-role key is ever exposed to clients.
alter table public.nkh_property_contacts enable row level security;
alter table public.nkh_room_types enable row level security;
alter table public.nkh_rate_plans enable row level security;
alter table public.nkh_rate_plan_prices enable row level security;
alter table public.nkh_rate_calendar_ranges enable row level security;
alter table public.nkh_property_policies enable row level security;
alter table public.nkh_property_faqs enable row level security;

commit;
