begin;

create table if not exists public.nkh_academy_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.nkh_staff(id) on delete cascade,
  staff_name text not null,
  assignment_date date not null,
  assignment_type text not null,
  course_id text,
  course_name text,
  question_count integer not null,
  duration_minutes integer not null,
  question_ids uuid[] not null default '{}',
  status text not null default 'Assigned',
  task_id uuid references public.nkh_tasks(id) on delete set null,
  started_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  score integer,
  correct_answers integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nkh_academy_assignment_type_check
    check (assignment_type in ('Daily', 'Monthly Exam')),
  constraint nkh_academy_assignment_status_check
    check (status in ('Assigned', 'In Progress', 'Completed', 'Expired')),
  constraint nkh_academy_assignment_question_count_check
    check (question_count in (10, 40)),
  constraint nkh_academy_assignment_duration_check
    check (duration_minutes in (20, 60)),
  constraint nkh_academy_assignment_staff_day_unique
    unique (staff_id, assignment_date)
);

create table if not exists public.nkh_academy_assignment_answers (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.nkh_academy_assignments(id) on delete cascade,
  question_id uuid not null references public.nkh_hospitality_questions(id) on delete cascade,
  selected_term text not null,
  correct_term text not null,
  definition_snapshot text not null,
  correct boolean not null,
  answered_at timestamptz not null default now(),
  constraint nkh_academy_assignment_answer_unique
    unique (assignment_id, question_id)
);

create index if not exists nkh_academy_assignments_staff_date_idx
  on public.nkh_academy_assignments(staff_id, assignment_date desc);
create index if not exists nkh_academy_assignments_status_idx
  on public.nkh_academy_assignments(status, assignment_date desc);
create index if not exists nkh_academy_assignment_answers_assignment_idx
  on public.nkh_academy_assignment_answers(assignment_id, answered_at);

drop trigger if exists nkh_academy_assignments_updated_at
  on public.nkh_academy_assignments;
create trigger nkh_academy_assignments_updated_at
  before update on public.nkh_academy_assignments
  for each row execute function public.nkh_set_updated_at();

alter table public.nkh_academy_assignments enable row level security;
alter table public.nkh_academy_assignment_answers enable row level security;

comment on table public.nkh_academy_assignments is
  'Roster-driven daily NKH Academy lessons and monthly staff examinations.';
comment on table public.nkh_academy_assignment_answers is
  'Answer-level result sheet for each Academy assignment or examination.';

commit;
