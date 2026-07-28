create table if not exists public.nkh_hospitality_questions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  term text not null,
  definition text not null,
  category text not null,
  difficulty text not null default 'Easy',
  image_prompt text null,
  image_url text null,
  image_status text not null default 'Pending',
  image_attempts integer not null default 0,
  image_last_error text null,
  image_generated_at timestamptz null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_hospitality_question_difficulty_check
    check (difficulty in ('Easy', 'Medium', 'Advanced')),
  constraint nkh_hospitality_question_image_status_check
    check (image_status in ('Pending', 'Generating', 'Ready', 'Failed'))
);

create index if not exists nkh_hospitality_questions_category_idx
  on public.nkh_hospitality_questions (category, difficulty)
  where active = true;

create index if not exists nkh_hospitality_questions_image_queue_idx
  on public.nkh_hospitality_questions (image_status, image_attempts, created_at)
  where active = true and image_url is null;

create table if not exists public.nkh_hospitality_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  play_date date not null,
  staff_name text not null,
  question_id uuid not null references public.nkh_hospitality_questions(id) on delete cascade,
  selected_term text not null,
  correct boolean not null,
  points integer not null default 0,
  answered_at timestamptz not null default now(),
  constraint nkh_hospitality_quiz_daily_question_unique
    unique (play_date, staff_name, question_id),
  constraint nkh_hospitality_quiz_points_check
    check (points between 0 and 30)
);

create index if not exists nkh_hospitality_quiz_attempts_day_idx
  on public.nkh_hospitality_quiz_attempts (play_date desc, staff_name, answered_at);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nkh-team-break',
  'nkh-team-break',
  true,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.nkh_hospitality_questions enable row level security;
alter table public.nkh_hospitality_quiz_attempts enable row level security;

comment on table public.nkh_hospitality_questions is
  'Curated NKH hospitality learning catalogue with a gradual prepared-image pipeline.';
comment on table public.nkh_hospitality_quiz_attempts is
  'Ten-question daily staff hospitality challenge results, separate from operational performance.';
