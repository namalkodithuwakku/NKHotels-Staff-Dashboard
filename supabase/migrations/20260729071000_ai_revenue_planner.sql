create table if not exists public.nkh_revenue_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.nkh_properties(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  objective text not null,
  generated_by text,
  inventory_snapshot jsonb not null default '{}'::jsonb,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint nkh_revenue_plans_period_check check (period_end >= period_start)
);

create index if not exists nkh_revenue_plans_property_idx
  on public.nkh_revenue_plans(property_id, created_at desc);

alter table public.nkh_revenue_plans enable row level security;

comment on table public.nkh_revenue_plans is
  'Master-generated advisory AI revenue plans. Recommendations never update live rates automatically.';
