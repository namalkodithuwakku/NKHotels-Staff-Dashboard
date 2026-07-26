-- NKH Dashboard — staff access controls for WhatsApp and SMS
-- Master accounts always retain both permissions.

begin;

alter table public.nkh_staff
  add column if not exists can_access_whatsapp boolean not null default false,
  add column if not exists can_access_sms boolean not null default false;

update public.nkh_staff
set can_access_whatsapp = true,
    can_access_sms = true
where access_level = 'Master';

commit;
