update public.nkh_hospitality_quiz_attempts
set points = case when correct then 10 else 0 end
where points is distinct from case when correct then 10 else 0 end;

comment on column public.nkh_hospitality_quiz_attempts.points is
  'Flat scoring: every correct Hospitality Challenge answer earns 10 points.';
