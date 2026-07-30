create table if not exists public.nkh_occupancy_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  property_snapshot jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  recommendation_source text not null default 'rules',
  generated_by text null,
  created_at timestamptz not null default now()
);

create index if not exists nkh_occupancy_reports_property_created_idx
  on public.nkh_occupancy_reports(property_id, created_at desc);
