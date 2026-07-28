create table if not exists public.nkh_email_filter_rules (
  id uuid primary key default gen_random_uuid(),
  sender_key text not null,
  subject_pattern text not null,
  ignore_reason text,
  ignore_count integer not null default 1,
  match_count integer not null default 0,
  is_active boolean not null default false,
  last_ignored_at timestamptz not null default now(),
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_key, subject_pattern)
);
create table if not exists public.nkh_email_filter_feedback (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.nkh_tasks(id) on delete set null,
  source_email_id text, sender_key text not null, subject_pattern text not null,
  ignore_reason text, actor_name text, created_at timestamptz not null default now()
);
create table if not exists public.nkh_email_ingestion_logs (
  id uuid primary key default gen_random_uuid(),
  source_email_id text, outcome text not null,
  task_id uuid references public.nkh_tasks(id) on delete set null,
  sender text, subject text,
  filter_rule_id uuid references public.nkh_email_filter_rules(id) on delete set null,
  error_message text, created_at timestamptz not null default now()
);
create index if not exists nkh_email_filter_rules_active_idx on public.nkh_email_filter_rules (is_active, sender_key, subject_pattern);
create index if not exists nkh_email_filter_feedback_task_idx on public.nkh_email_filter_feedback (task_id);
create index if not exists nkh_email_ingestion_logs_message_idx on public.nkh_email_ingestion_logs (source_email_id, created_at desc);
alter table public.nkh_email_filter_rules enable row level security;
alter table public.nkh_email_filter_feedback enable row level security;
alter table public.nkh_email_ingestion_logs enable row level security;
drop trigger if exists nkh_email_filter_rules_updated_at on public.nkh_email_filter_rules;
create trigger nkh_email_filter_rules_updated_at before update on public.nkh_email_filter_rules
for each row execute function public.nkh_set_updated_at();
