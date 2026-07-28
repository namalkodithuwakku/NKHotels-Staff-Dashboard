create table if not exists public.nkh_team_pet_state (
  id smallint primary key default 1,
  name text not null default 'Niko',
  mood text not null default 'Calm',
  happiness integer not null default 72,
  energy integer not null default 68,
  accessory text not null default 'amber_scarf',
  enabled boolean not null default true,
  last_interaction_by text null,
  last_interaction_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint nkh_team_pet_singleton_check check (id = 1),
  constraint nkh_team_pet_happiness_check check (happiness between 0 and 100),
  constraint nkh_team_pet_energy_check check (energy between 0 and 100),
  constraint nkh_team_pet_accessory_check check (
    accessory in ('none', 'amber_scarf', 'blue_cap', 'flower_crown', 'birthday_hat')
  )
);

create table if not exists public.nkh_team_pet_interactions (
  id uuid primary key default gen_random_uuid(),
  staff_name text not null,
  action text not null,
  interaction_date date not null,
  created_at timestamptz not null default now(),
  constraint nkh_team_pet_action_check check (action in ('pat', 'feed', 'wave'))
);

create index if not exists nkh_team_pet_interactions_staff_day_idx
  on public.nkh_team_pet_interactions (interaction_date desc, lower(staff_name), created_at);

insert into public.nkh_team_pet_state (id)
values (1)
on conflict (id) do nothing;

alter table public.nkh_team_pet_state enable row level security;
alter table public.nkh_team_pet_interactions enable row level security;

comment on table public.nkh_team_pet_state is
  'Shared lightweight Niko mascot state for NKH Dashboard staff.';
comment on table public.nkh_team_pet_interactions is
  'Optional pet interactions limited by the authenticated server route.';
