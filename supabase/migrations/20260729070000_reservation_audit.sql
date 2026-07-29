create table if not exists public.nkh_reservation_audits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  ota_source text not null,
  file_name text not null,
  file_type text,
  status text not null default 'Processing',
  imported_count integer not null default 0,
  dashboard_count integer not null default 0,
  matched_count integer not null default 0,
  difference_count integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.nkh_reservation_audit_items (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.nkh_reservation_audits(id) on delete cascade,
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  finding_type text not null,
  severity text not null,
  match_score integer not null default 0,
  ota_reference text,
  guest_name text,
  check_in date,
  check_out date,
  differences jsonb not null default '[]'::jsonb,
  ota_data jsonb not null default '{}'::jsonb,
  dashboard_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nkh_reservation_audits_property_idx
  on public.nkh_reservation_audits(property_id, created_at desc);
create index if not exists nkh_reservation_audit_items_audit_idx
  on public.nkh_reservation_audit_items(audit_id, severity, finding_type);

alter table public.nkh_reservation_audits enable row level security;
alter table public.nkh_reservation_audit_items enable row level security;

comment on table public.nkh_reservation_audits is
  'Master-only OTA-to-calendar reconciliation runs. Uploaded source documents are not stored.';
