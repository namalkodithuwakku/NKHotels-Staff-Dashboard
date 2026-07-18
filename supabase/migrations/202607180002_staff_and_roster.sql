-- N K Hotels Staff Dashboard — Migration 2
-- Staff directory and July 2026 roster import.
-- Existing Google roster and all WhatsApp/task tables remain unchanged.

begin;

create table if not exists public.nkh_staff (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text,
  phone text,
  whatsapp_number text,
  access_level text not null default 'Team',
  employment_status text not null default 'Active',
  timezone text not null default 'Asia/Colombo',
  color_hex text not null default '#E98A15',
  google_staff_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_staff_display_name_key unique (display_name),
  constraint nkh_staff_access_check check (access_level in ('Master', 'Supervisor', 'Team')),
  constraint nkh_staff_status_check check (employment_status in ('Active', 'Inactive', 'Leave')),
  constraint nkh_staff_color_check check (color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.nkh_roster_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.nkh_staff(id) on delete restrict,
  property_id uuid references public.nkh_properties(id) on delete set null,
  shift_date date not null,
  start_time time,
  end_time time,
  status text not null default 'Scheduled',
  shift_label text,
  notes text,
  source text not null default 'Dashboard',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_roster_status_check check (status in ('Scheduled', 'Off', 'Leave', 'Cancelled')),
  constraint nkh_roster_times_check check (
    (status = 'Scheduled' and start_time is not null and end_time is not null)
    or (status <> 'Scheduled')
  )
);

create table if not exists public.nkh_roster_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  staff_id uuid not null references public.nkh_staff(id) on delete cascade,
  property_id uuid references public.nkh_properties(id) on delete set null,
  weekday smallint not null,
  start_time time,
  end_time time,
  status text not null default 'Scheduled',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_roster_templates_weekday_check check (weekday between 0 and 6),
  constraint nkh_roster_templates_status_check check (status in ('Scheduled', 'Off'))
);

create table if not exists public.nkh_shift_sessions (
  id uuid primary key default gen_random_uuid(),
  roster_entry_id uuid references public.nkh_roster_entries(id) on delete set null,
  staff_id uuid not null references public.nkh_staff(id) on delete restrict,
  property_id uuid references public.nkh_properties(id) on delete set null,
  clocked_in_at timestamptz not null,
  clocked_out_at timestamptz,
  status text not null default 'Active',
  clock_in_note text,
  clock_out_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_shift_sessions_status_check check (status in ('Active', 'Completed', 'Cancelled')),
  constraint nkh_shift_sessions_time_check check (clocked_out_at is null or clocked_out_at >= clocked_in_at)
);

create table if not exists public.nkh_roster_events (
  id uuid primary key default gen_random_uuid(),
  roster_entry_id uuid references public.nkh_roster_entries(id) on delete cascade,
  staff_id uuid references public.nkh_staff(id) on delete set null,
  event_type text not null,
  actor_name text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nkh_roster_entries_date_idx on public.nkh_roster_entries(shift_date);
create index if not exists nkh_roster_entries_staff_date_idx on public.nkh_roster_entries(staff_id, shift_date);
create index if not exists nkh_roster_entries_property_date_idx on public.nkh_roster_entries(property_id, shift_date);
create index if not exists nkh_shift_sessions_active_idx on public.nkh_shift_sessions(staff_id, status, clocked_in_at);
create index if not exists nkh_roster_events_entry_idx on public.nkh_roster_events(roster_entry_id, created_at);

drop trigger if exists nkh_staff_updated_at on public.nkh_staff;
create trigger nkh_staff_updated_at before update on public.nkh_staff for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_roster_entries_updated_at on public.nkh_roster_entries;
create trigger nkh_roster_entries_updated_at before update on public.nkh_roster_entries for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_roster_templates_updated_at on public.nkh_roster_templates;
create trigger nkh_roster_templates_updated_at before update on public.nkh_roster_templates for each row execute function public.nkh_set_updated_at();
drop trigger if exists nkh_shift_sessions_updated_at on public.nkh_shift_sessions;
create trigger nkh_shift_sessions_updated_at before update on public.nkh_shift_sessions for each row execute function public.nkh_set_updated_at();

alter table public.nkh_staff enable row level security;
alter table public.nkh_roster_entries enable row level security;
alter table public.nkh_roster_templates enable row level security;
alter table public.nkh_shift_sessions enable row level security;
alter table public.nkh_roster_events enable row level security;

insert into public.nkh_staff (display_name, google_staff_name, color_hex)
values
  ('Visun', 'Visun', '#3F82D5'),
  ('Gayan', 'Gayan', '#E98A15'),
  ('Hashitha', 'Hashitha', '#3DA56A'),
  ('Namal', 'Namal', '#8565C4')
on conflict (display_name) do update set google_staff_name = excluded.google_staff_name;

-- Imported from the supplied July 2026 roster. Multiple shifts for the same
-- person/date are separate records. Blank cells and dashes are not imported.
with imported(display_name, shift_date, start_time, end_time, status) as (
  values
    ('Visun','2026-07-01'::date,'06:00'::time,'14:00'::time,'Scheduled'),('Gayan','2026-07-01','14:00','22:00','Scheduled'),
    ('Visun','2026-07-02','06:00','14:00','Scheduled'),('Gayan','2026-07-02','14:00','22:00','Scheduled'),
    ('Visun','2026-07-03','06:00','14:00','Scheduled'),('Gayan','2026-07-03','14:00','22:00','Scheduled'),
    ('Visun','2026-07-04','06:00','14:00','Scheduled'),('Gayan','2026-07-04',null,null,'Off'),('Hashitha','2026-07-04','14:00','22:00','Scheduled'),
    ('Visun','2026-07-05','06:00','14:00','Scheduled'),('Gayan','2026-07-05',null,null,'Off'),('Hashitha','2026-07-05','14:00','22:00','Scheduled'),
    ('Visun','2026-07-06','06:00','14:00','Scheduled'),('Gayan','2026-07-06','14:00','22:00','Scheduled'),
    ('Visun','2026-07-07','06:00','14:00','Scheduled'),('Gayan','2026-07-07','14:00','22:00','Scheduled'),
    ('Visun','2026-07-08','08:00','14:00','Scheduled'),('Gayan','2026-07-08','14:00','22:00','Scheduled'),
    ('Visun','2026-07-09','08:00','16:00','Scheduled'),('Gayan','2026-07-09',null,null,'Off'),('Namal','2026-07-09','16:00','22:00','Scheduled'),
    ('Visun','2026-07-10','06:00','14:00','Scheduled'),('Gayan','2026-07-10','14:00','22:00','Scheduled'),
    ('Visun','2026-07-11',null,null,'Off'),('Gayan','2026-07-11','14:00','22:00','Scheduled'),('Hashitha','2026-07-11','06:00','14:00','Scheduled'),
    ('Visun','2026-07-12',null,null,'Off'),('Gayan','2026-07-12','14:00','22:00','Scheduled'),('Hashitha','2026-07-12','06:00','14:00','Scheduled'),
    ('Visun','2026-07-13','06:00','14:00','Scheduled'),('Gayan','2026-07-13','14:00','22:00','Scheduled'),
    ('Visun','2026-07-14','06:00','12:00','Scheduled'),('Gayan','2026-07-14','12:00','22:00','Scheduled'),
    ('Visun','2026-07-15','06:00','14:00','Scheduled'),('Gayan','2026-07-15','08:00','14:00','Scheduled'),('Visun','2026-07-15','14:00','22:00','Scheduled'),
    ('Visun','2026-07-16','06:00','14:00','Scheduled'),('Gayan','2026-07-16','14:00','22:00','Scheduled'),
    ('Visun','2026-07-17','06:00','14:00','Scheduled'),('Gayan','2026-07-17','14:00','22:00','Scheduled'),
    ('Visun','2026-07-18','14:00','22:00','Scheduled'),('Gayan','2026-07-18',null,null,'Off'),('Hashitha','2026-07-18','06:00','14:00','Scheduled'),
    ('Visun','2026-07-19','14:00','22:00','Scheduled'),('Gayan','2026-07-19',null,null,'Off'),('Hashitha','2026-07-19','06:00','14:00','Scheduled'),
    ('Visun','2026-07-20','06:00','14:00','Scheduled'),('Gayan','2026-07-20','14:00','22:00','Scheduled'),
    ('Visun','2026-07-21','06:00','14:00','Scheduled'),('Gayan','2026-07-21','14:00','22:00','Scheduled'),
    ('Visun','2026-07-22','06:00','14:00','Scheduled'),('Gayan','2026-07-22','14:00','22:00','Scheduled'),
    ('Visun','2026-07-23','06:00','14:00','Scheduled'),('Gayan','2026-07-23','14:00','22:00','Scheduled'),
    ('Visun','2026-07-24','06:00','14:00','Scheduled'),('Gayan','2026-07-24','14:00','22:00','Scheduled'),
    ('Visun','2026-07-25',null,null,'Off'),('Gayan','2026-07-25','14:00','22:00','Scheduled'),('Hashitha','2026-07-25','06:00','14:00','Scheduled'),
    ('Visun','2026-07-26',null,null,'Off'),('Gayan','2026-07-26','14:00','22:00','Scheduled'),('Hashitha','2026-07-26','06:00','14:00','Scheduled')
)
insert into public.nkh_roster_entries (staff_id, shift_date, start_time, end_time, status, source, notes)
select s.id, i.shift_date, i.start_time, i.end_time, i.status, 'Google Sheet Import', 'Imported from July 2026 roster'
from imported i join public.nkh_staff s on s.display_name = i.display_name
where not exists (
  select 1 from public.nkh_roster_entries r
  where r.staff_id = s.id and r.shift_date = i.shift_date and r.status = i.status
    and r.start_time is not distinct from i.start_time and r.end_time is not distinct from i.end_time
);

commit;
