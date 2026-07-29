alter table public.nkh_room_types
  add column if not exists room_names text[] not null default '{}';

comment on column public.nkh_room_types.room_names is
  'Ordered physical room names or numbers belonging to this room type.';
