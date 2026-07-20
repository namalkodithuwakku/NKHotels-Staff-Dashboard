-- Display staff usernames with an initial capital while retaining case-insensitive uniqueness.
begin;

alter table public.nkh_staff
  drop constraint if exists nkh_staff_login_username_check;

update public.nkh_staff
set login_username = upper(left(login_username, 1)) || lower(substring(login_username from 2))
where login_username is not null and login_username <> '';

alter table public.nkh_staff
  add constraint nkh_staff_login_username_check check (
    login_username is null or login_username ~ '^[A-Z][a-z0-9._-]{2,39}$'
  );

commit;
