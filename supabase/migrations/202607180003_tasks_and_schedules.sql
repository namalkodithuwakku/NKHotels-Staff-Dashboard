-- N K Hotels Staff Dashboard — Migration 3
-- Canonical tasks, schedules, events and notification history.
-- Google remains live until the dashboard routes are switched and verified.

begin;

create table if not exists public.nkh_tasks (
  id uuid primary key default gen_random_uuid(),
  legacy_task_id text unique,
  status text not null default 'Pending',
  priority text not null default 'Normal',
  intent text,
  task_type text not null default 'Other',
  source text not null default 'Staff Dashboard',
  property_id uuid references public.nkh_properties(id) on delete set null,
  property_name_snapshot text,
  booking_id text,
  subject text not null,
  notes text,
  assigned_staff_id uuid references public.nkh_staff(id) on delete set null,
  assigned_name_snapshot text,
  shift_label text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by_staff_id uuid references public.nkh_staff(id) on delete set null,
  completed_by_name_snapshot text,
  completion_note text,
  source_email_id text,
  source_gmail_url text,
  source_whatsapp_message_id uuid references public.wa_messages(id) on delete set null,
  source_conversation_id uuid references public.wa_conversations(id) on delete set null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_by_staff_id uuid references public.nkh_staff(id) on delete set null,
  created_by_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint nkh_tasks_status_check check (status in ('Pending', 'In Progress', 'Done', 'Cancelled', 'Ignored')),
  constraint nkh_tasks_priority_check check (priority in ('Normal', 'High', 'Urgent', 'Critical')),
  constraint nkh_tasks_subject_check check (length(trim(subject)) > 0)
);

create table if not exists public.nkh_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.nkh_tasks(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_staff_id uuid references public.nkh_staff(id) on delete set null,
  actor_name_snapshot text,
  note text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.nkh_scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  task_type text not null default 'Other',
  source text not null default 'Scheduled',
  property_id uuid references public.nkh_properties(id) on delete set null,
  property_name_snapshot text,
  subject text not null,
  notes text,
  priority text not null default 'Normal',
  assigned_staff_id uuid references public.nkh_staff(id) on delete set null,
  assigned_name_snapshot text,
  schedule_type text not null default 'Once',
  run_at timestamptz,
  timezone text not null default 'Asia/Colombo',
  weekday smallint,
  day_of_month smallint,
  local_time time,
  is_active boolean not null default true,
  last_generated_at timestamptz,
  next_run_at timestamptz,
  created_by_staff_id uuid references public.nkh_staff(id) on delete set null,
  created_by_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_scheduled_tasks_type_check check (schedule_type in ('Once', 'Daily', 'Weekly', 'Monthly')),
  constraint nkh_scheduled_tasks_priority_check check (priority in ('Normal', 'High', 'Urgent', 'Critical')),
  constraint nkh_scheduled_tasks_weekday_check check (weekday is null or weekday between 0 and 6),
  constraint nkh_scheduled_tasks_monthday_check check (day_of_month is null or day_of_month between 1 and 31)
);

create table if not exists public.nkh_task_notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.nkh_tasks(id) on delete cascade,
  staff_id uuid references public.nkh_staff(id) on delete set null,
  channel text not null,
  notification_type text not null,
  destination_masked text,
  message_preview text,
  provider_reference text,
  delivery_status text not null default 'Pending',
  attempt_count integer not null default 0,
  dedupe_key text unique,
  provider_response jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_task_notifications_channel_check check (channel in ('SMS', 'Email', 'Dashboard')),
  constraint nkh_task_notifications_status_check check (delivery_status in ('Pending', 'Sent', 'Failed', 'Skipped')),
  constraint nkh_task_notifications_attempt_check check (attempt_count >= 0)
);

create unique index if not exists nkh_tasks_source_email_key
  on public.nkh_tasks(source_email_id) where source_email_id is not null;
create unique index if not exists nkh_tasks_source_whatsapp_key
  on public.nkh_tasks(source_whatsapp_message_id) where source_whatsapp_message_id is not null;
create index if not exists nkh_tasks_queue_idx
  on public.nkh_tasks(status, priority, created_at desc) where archived_at is null;
create index if not exists nkh_tasks_staff_idx
  on public.nkh_tasks(assigned_staff_id, status, created_at desc);
create index if not exists nkh_tasks_property_idx
  on public.nkh_tasks(property_id, status, created_at desc);
create index if not exists nkh_tasks_due_idx
  on public.nkh_tasks(due_at) where status in ('Pending', 'In Progress');
create index if not exists nkh_task_events_task_idx
  on public.nkh_task_events(task_id, created_at desc);
create index if not exists nkh_scheduled_tasks_next_idx
  on public.nkh_scheduled_tasks(next_run_at) where is_active = true;
create index if not exists nkh_task_notifications_task_idx
  on public.nkh_task_notifications(task_id, created_at desc);

drop trigger if exists nkh_tasks_updated_at on public.nkh_tasks;
create trigger nkh_tasks_updated_at before update on public.nkh_tasks
  for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_scheduled_tasks_updated_at on public.nkh_scheduled_tasks;
create trigger nkh_scheduled_tasks_updated_at before update on public.nkh_scheduled_tasks
  for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_task_notifications_updated_at on public.nkh_task_notifications;
create trigger nkh_task_notifications_updated_at before update on public.nkh_task_notifications
  for each row execute function public.nkh_set_updated_at();

alter table public.nkh_tasks enable row level security;
alter table public.nkh_task_events enable row level security;
alter table public.nkh_scheduled_tasks enable row level security;
alter table public.nkh_task_notifications enable row level security;

commit;
