create table if not exists public.nkh_ai_monitor_reports (
  id uuid primary key default gen_random_uuid(),
  report_time timestamptz not null default now(),
  period_from timestamptz,
  period_to timestamptz,
  summary text,
  attention_count integer not null default 0 check (attention_count >= 0),
  urgent_count integer not null default 0 check (urgent_count >= 0),
  items jsonb not null default '[]'::jsonb,
  source text not null default 'AI Monitor',
  created_at timestamptz not null default now()
);

create index if not exists nkh_ai_monitor_reports_report_time_idx
  on public.nkh_ai_monitor_reports (report_time desc);

create table if not exists public.nkh_ai_monitor_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.nkh_ai_monitor_reports(id) on delete cascade,
  item_key text not null,
  staff_name text not null,
  comment_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists nkh_ai_monitor_comments_report_item_idx
  on public.nkh_ai_monitor_comments (report_id, item_key, created_at asc);

alter table public.nkh_ai_monitor_reports enable row level security;
alter table public.nkh_ai_monitor_comments enable row level security;
