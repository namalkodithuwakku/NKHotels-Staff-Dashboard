begin;

-- Visun and Dinuka are the same staff member.
-- Preserve the existing Visun UUID/history and rename that record to Dinuka.
-- If a temporary Dinuka record was already created, move its dependent roster data
-- to the original staff record before removing the duplicate.

do $$
declare
  visun_id uuid;
  dinuka_id uuid;
begin
  select id into visun_id from public.nkh_staff where lower(display_name) = 'visun' limit 1;
  select id into dinuka_id from public.nkh_staff where lower(display_name) = 'dinuka' limit 1;

  if visun_id is not null and dinuka_id is not null and visun_id <> dinuka_id then
    update public.nkh_roster_entries set staff_id = visun_id where staff_id = dinuka_id;
    update public.nkh_roster_templates set staff_id = visun_id where staff_id = dinuka_id;
    update public.nkh_shift_sessions set staff_id = visun_id where staff_id = dinuka_id;
    update public.nkh_roster_events set staff_id = visun_id where staff_id = dinuka_id;
    delete from public.nkh_staff where id = dinuka_id;
  end if;

  if visun_id is not null then
    update public.nkh_staff
    set display_name = 'Dinuka',
        google_staff_name = 'Dinuka',
        employment_status = 'Active'
    where id = visun_id;
  elsif dinuka_id is null then
    insert into public.nkh_staff (display_name, google_staff_name, color_hex)
    values ('Dinuka', 'Dinuka', '#3F82D5');
  end if;
end $$;

commit;
