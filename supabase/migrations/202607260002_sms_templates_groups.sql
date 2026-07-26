-- NKH Dashboard — saved SMS templates and recipient groups
-- Safe to run more than once. Existing SMS records are not changed.

begin;

create extension if not exists pgcrypto;

create table if not exists public.nkh_sms_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  message text not null,
  category text not null default 'General',
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_sms_templates_name_check check (char_length(trim(name)) between 2 and 60),
  constraint nkh_sms_templates_message_check check (char_length(trim(message)) between 1 and 450)
);

create table if not exists public.nkh_sms_recipient_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  recipients jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_sms_groups_name_check check (char_length(trim(name)) between 2 and 60),
  constraint nkh_sms_groups_recipients_array_check check (jsonb_typeof(recipients) = 'array')
);

create unique index if not exists nkh_sms_templates_name_unique
  on public.nkh_sms_templates(lower(name)) where active;
create unique index if not exists nkh_sms_groups_name_unique
  on public.nkh_sms_recipient_groups(lower(name)) where active;

drop trigger if exists nkh_sms_templates_updated_at on public.nkh_sms_templates;
create trigger nkh_sms_templates_updated_at before update on public.nkh_sms_templates
for each row execute function public.nkh_set_updated_at();

drop trigger if exists nkh_sms_groups_updated_at on public.nkh_sms_recipient_groups;
create trigger nkh_sms_groups_updated_at before update on public.nkh_sms_recipient_groups
for each row execute function public.nkh_set_updated_at();

alter table public.nkh_sms_templates enable row level security;
alter table public.nkh_sms_recipient_groups enable row level security;

commit;
