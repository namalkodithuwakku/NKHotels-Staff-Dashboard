begin;

insert into public.nkh_staff (display_name, google_staff_name, color_hex)
values ('Dinuka', 'Dinuka', '#D97706')
on conflict (display_name) do update
set google_staff_name = excluded.google_staff_name,
    employment_status = 'Active';

commit;
