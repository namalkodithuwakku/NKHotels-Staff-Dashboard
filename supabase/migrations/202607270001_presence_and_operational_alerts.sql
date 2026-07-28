create table if not exists public.nkh_staff_presence (
  staff_id uuid primary key references public.nkh_staff(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  visibility_state text not null default 'Visible',
  current_view text,
  updated_at timestamptz not null default now(),
  constraint nkh_staff_presence_visibility_check check (visibility_state in ('Visible', 'Hidden'))
);
create table if not exists public.nkh_alert_settings (
  id text primary key default 'primary',
  staff_alerts_enabled boolean not null default true,
  master_alerts_enabled boolean not null default true,
  whatsapp_wait_minutes integer not null default 10,
  task_wait_minutes integer not null default 10,
  email_full_threshold integer not null default 10,
  cooldown_minutes integer not null default 60,
  offline_after_minutes integer not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.nkh_alert_settings (id) values ('primary') on conflict (id) do nothing;
create table if not exists public.nkh_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  recipient_staff_id uuid references public.nkh_staff(id) on delete set null,
  recipient_name text,
  phone_masked text,
  message text not null,
  snapshot jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  delivery_status text not null default 'Pending',
  provider_response jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nkh_staff_presence_seen_idx on public.nkh_staff_presence(last_seen_at desc);
create index if not exists nkh_operational_alerts_created_idx on public.nkh_operational_alerts(created_at desc);
alter table public.nkh_staff_presence enable row level security;
alter table public.nkh_alert_settings enable row level security;
alter table public.nkh_operational_alerts enable row level security;
