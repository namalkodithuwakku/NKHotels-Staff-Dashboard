-- State cursor for Gmail history synchronization.
begin;

create table if not exists public.nkh_gmail_sync_state (
  id text primary key,
  email_address text,
  last_history_id text,
  watch_expiration_at timestamptz,
  last_watch_at timestamptz,
  last_notification_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists nkh_gmail_sync_state_updated_at on public.nkh_gmail_sync_state;
create trigger nkh_gmail_sync_state_updated_at before update on public.nkh_gmail_sync_state
  for each row execute function public.nkh_set_updated_at();

alter table public.nkh_gmail_sync_state enable row level security;

commit;
