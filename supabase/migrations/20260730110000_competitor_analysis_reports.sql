-- Saved, source-backed competitor research reports for NKH Tools.
create table if not exists public.nkh_competitor_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  check_in date not null,
  check_out date not null,
  adults integer not null default 2 check (adults between 1 and 20),
  rooms integer not null default 1 check (rooms between 1 and 10),
  competitor_count integer not null default 5 check (competitor_count between 3 and 10),
  objective text not null default 'Full market analysis',
  property_snapshot jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  generated_by text null,
  research_status text not null default 'completed',
  openai_response_id text null,
  research_error text null,
  created_at timestamptz not null default now()
);

alter table public.nkh_competitor_reports
  add column if not exists research_status text not null default 'completed',
  add column if not exists openai_response_id text null,
  add column if not exists research_error text null;

create index if not exists nkh_competitor_reports_property_created_idx
  on public.nkh_competitor_reports(property_id, created_at desc);
