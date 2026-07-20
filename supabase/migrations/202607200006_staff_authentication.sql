-- Supabase staff authentication. PINs are stored only as salted scrypt hashes.
begin;

alter table public.nkh_staff
  add column if not exists login_username text,
  add column if not exists pin_hash text,
  add column if not exists login_enabled boolean not null default true,
  add column if not exists pin_updated_at timestamptz,
  add column if not exists last_login_at timestamptz;

update public.nkh_staff
set login_username = lower(regexp_replace(trim(display_name), '[^a-zA-Z0-9._-]+', '', 'g'))
where login_username is null;

create unique index if not exists nkh_staff_login_username_key
  on public.nkh_staff (lower(login_username))
  where login_username is not null;

alter table public.nkh_staff
  drop constraint if exists nkh_staff_login_username_check;
alter table public.nkh_staff
  add constraint nkh_staff_login_username_check check (
    login_username is null or login_username ~ '^[a-z0-9._-]{3,40}$'
  );

alter table public.nkh_staff
  drop constraint if exists nkh_staff_pin_hash_check;
alter table public.nkh_staff
  add constraint nkh_staff_pin_hash_check check (
    pin_hash is null or pin_hash like 'scrypt$%'
  );

commit;
