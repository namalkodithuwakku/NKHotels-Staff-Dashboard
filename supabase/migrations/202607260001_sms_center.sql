-- NKH Dashboard — Stage 1 outbound SMS Center
-- Safe to run more than once. No existing records are changed or removed.

begin;

create extension if not exists pgcrypto;

create table if not exists public.nkh_sms_messages (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null default gen_random_uuid(),
  recipient_type text not null default 'Custom',
  recipient_id uuid,
  recipient_name text,
  property_id uuid references public.nkh_properties(id) on delete set null,
  property_name text,
  phone text not null,
  phone_masked text not null,
  message text not null,
  message_parts integer not null default 1,
  delivery_status text not null default 'Pending',
  provider_reference text,
  provider_response jsonb,
  error_message text,
  attempt_count integer not null default 0,
  sent_by text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_sms_recipient_type_check check (
    recipient_type in ('Staff', 'Client', 'Lead', 'Custom')
  ),
  constraint nkh_sms_delivery_status_check check (
    delivery_status in ('Pending', 'Sent', 'Failed')
  ),
  constraint nkh_sms_attempt_count_check check (attempt_count >= 0),
  constraint nkh_sms_message_parts_check check (message_parts > 0)
);

create index if not exists nkh_sms_messages_created_idx
  on public.nkh_sms_messages(created_at desc);
create index if not exists nkh_sms_messages_status_idx
  on public.nkh_sms_messages(delivery_status, created_at desc);
create index if not exists nkh_sms_messages_batch_idx
  on public.nkh_sms_messages(batch_id);

drop trigger if exists nkh_sms_messages_updated_at on public.nkh_sms_messages;
create trigger nkh_sms_messages_updated_at before update on public.nkh_sms_messages
for each row execute function public.nkh_set_updated_at();

alter table public.nkh_sms_messages enable row level security;

commit;
