-- Kids-Organizer: Schule, Lern-XP und Aufgaben daheim
create table if not exists public.school_profiles (
  child_id uuid primary key references public.child_profiles(id) on delete cascade,
  school_name text not null default '',
  school_type text not null default '',
  class_name text not null default '',
  grade_level integer check (grade_level between 1 and 13),
  federal_state text not null default 'DE-BY',
  school_year text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#ffc55b',
  is_major boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.school_teachers (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  subject_id uuid references public.school_subjects(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  role text not null default 'Fachlehrer',
  email text,
  phone text,
  office_hours text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.school_timetable (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  subject_id uuid not null references public.school_subjects(id) on delete cascade,
  teacher_id uuid references public.school_teachers(id) on delete set null,
  weekday integer not null check (weekday between 1 and 7),
  period integer not null check (period between 1 and 12),
  starts_at time,
  ends_at time,
  room text,
  unique(child_id, weekday, period)
);

create table if not exists public.school_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  subject_id uuid references public.school_subjects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  event_type text not null default 'Schulaufgabe' check (event_type in ('Schulaufgabe','Test','Referat','Abgabe','Elternabend','Schultermin')),
  due_at timestamptz not null,
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.school_grades (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  subject_id uuid not null references public.school_subjects(id) on delete cascade,
  grade numeric(3,2) not null check (grade between 1 and 6),
  category text not null default 'Sonstiges' check (category in ('Schulaufgabe','Test','Mündlich','Referat','Sonstiges')),
  weight numeric(4,2) not null default 1 check (weight > 0 and weight <= 10),
  title text,
  graded_on date not null default current_date,
  xp_awarded integer not null default 0 check (xp_awarded between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  subject_id uuid references public.school_subjects(id) on delete set null,
  minutes integer not null check (minutes between 5 and 120),
  xp_awarded integer not null check (xp_awarded between 0 and 40),
  completed_at timestamptz not null default now()
);

create table if not exists public.home_tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  details text,
  xp_reward integer not null default 10 check (xp_reward between 1 and 100),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists school_subjects_child_idx on public.school_subjects(child_id);
create index if not exists school_teachers_child_idx on public.school_teachers(child_id);
create index if not exists school_timetable_child_idx on public.school_timetable(child_id,weekday,period);
create index if not exists school_events_child_due_idx on public.school_events(child_id,due_at);
create index if not exists school_grades_child_idx on public.school_grades(child_id,subject_id);
create index if not exists learning_sessions_child_idx on public.learning_sessions(child_id,completed_at desc);
create index if not exists home_tasks_child_idx on public.home_tasks(child_id,completed_at,due_at);

alter table public.school_profiles enable row level security;
alter table public.school_subjects enable row level security;
alter table public.school_teachers enable row level security;
alter table public.school_timetable enable row level security;
alter table public.school_events enable row level security;
alter table public.school_grades enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.home_tasks enable row level security;

do $$ declare t text; begin
  foreach t in array array['school_profiles','school_subjects','school_teachers','school_timetable','school_events','school_grades','learning_sessions','home_tasks'] loop
    execute format('drop policy if exists "Parents manage organizer" on public.%I',t);
    execute format('create policy "Parents manage organizer" on public.%I for all to authenticated using (exists (select 1 from public.child_profiles c where c.id=child_id and c.parent_id=(select auth.uid()))) with check (exists (select 1 from public.child_profiles c where c.id=child_id and c.parent_id=(select auth.uid())))',t);
  end loop;
end $$;

grant select,insert,update,delete on public.school_profiles,public.school_subjects,public.school_teachers,public.school_timetable,public.school_events,public.school_grades,public.learning_sessions,public.home_tasks to authenticated;
revoke all on public.school_profiles,public.school_subjects,public.school_teachers,public.school_timetable,public.school_events,public.school_grades,public.learning_sessions,public.home_tasks from anon;

create or replace function public.buhrsi_organizer_snapshot(p_child uuid,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare is_parent boolean; result jsonb;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  select exists(select 1 from public.child_profiles where id=p_child and parent_id=auth.uid()) into is_parent;
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from public.school_profiles p where p.child_id=p_child),
    'subjects',coalesce((select jsonb_agg(to_jsonb(s) order by s.is_major desc,s.name) from public.school_subjects s where s.child_id=p_child),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(case when is_parent then to_jsonb(t) else to_jsonb(t)-'email'-'phone'-'office_hours'-'notes' end order by t.name) from public.school_teachers t where t.child_id=p_child),'[]'::jsonb),
    'timetable',coalesce((select jsonb_agg(to_jsonb(x) order by x.weekday,x.period) from public.school_timetable x where x.child_id=p_child),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.due_at) from public.school_events e where e.child_id=p_child),'[]'::jsonb),
    'grades',coalesce((select jsonb_agg(to_jsonb(g) order by g.graded_on desc) from public.school_grades g where g.child_id=p_child),'[]'::jsonb),
    'learning',coalesce((select jsonb_agg(to_jsonb(l) order by l.completed_at desc) from (select * from public.learning_sessions where child_id=p_child order by completed_at desc limit 30) l),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(h) order by h.completed_at nulls first,h.due_at nulls last) from public.home_tasks h where h.child_id=p_child),'[]'::jsonb),
    'is_parent',is_parent
  ) into result;
  return result;
end $$;

create or replace function public.buhrsi_log_learning(p_child uuid,p_minutes integer,p_subject uuid default null,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare award integer; new_xp integer; today_count integer;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  if p_minutes < 5 or p_minutes > 120 then raise exception 'Lernzeit muss zwischen 5 und 120 Minuten liegen'; end if;
  if p_subject is not null and not exists(select 1 from public.school_subjects where id=p_subject and child_id=p_child) then raise exception 'Fach gehört nicht zu diesem Profil'; end if;
  select count(*) into today_count from public.learning_sessions where child_id=p_child and completed_at::date=current_date;
  if today_count >= 6 then raise exception 'Heute wurden bereits sechs Lernzeiten eingetragen'; end if;
  award:=least(40,greatest(5,floor(p_minutes/15.0)::integer*5));
  insert into public.learning_sessions(child_id,subject_id,minutes,xp_awarded) values(p_child,p_subject,p_minutes,award);
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('xp_awarded',award,'xp',new_xp);
end $$;

create or replace function public.buhrsi_complete_home_task(p_child uuid,p_task uuid,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare award integer; new_xp integer;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  update public.home_tasks set completed_at=now() where id=p_task and child_id=p_child and completed_at is null returning xp_reward into award;
  if award is null then raise exception 'Aufgabe wurde schon erledigt oder nicht gefunden'; end if;
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('xp_awarded',award,'xp',new_xp);
end $$;

create or replace function public.buhrsi_add_grade(p_child uuid,p_subject uuid,p_grade numeric,p_category text,p_weight numeric,p_title text,p_graded_on date)
returns jsonb language plpgsql security definer set search_path='public','extensions' as $$
declare award integer; row_id uuid; new_xp integer;
begin
  if not exists(select 1 from public.child_profiles where id=p_child and parent_id=auth.uid()) then raise exception 'Nur Eltern dürfen Noten eintragen'; end if;
  if p_grade < 1 or p_grade > 6 then raise exception 'Note muss zwischen 1 und 6 liegen'; end if;
  if not exists(select 1 from public.school_subjects where id=p_subject and child_id=p_child) then raise exception 'Fach gehört nicht zu diesem Profil'; end if;
  award:=case when p_grade<1.5 then 50 when p_grade<2.5 then 40 when p_grade<3.5 then 30 when p_grade<4.5 then 20 when p_grade<5.5 then 10 else 5 end;
  insert into public.school_grades(child_id,subject_id,grade,category,weight,title,graded_on,xp_awarded)
  values(p_child,p_subject,p_grade,p_category,p_weight,p_title,coalesce(p_graded_on,current_date),award) returning id into row_id;
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('id',row_id,'xp_awarded',award,'xp',new_xp);
end $$;

revoke all on function public.buhrsi_organizer_snapshot(uuid,text),public.buhrsi_log_learning(uuid,integer,uuid,text),public.buhrsi_complete_home_task(uuid,uuid,text),public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date) from public;
revoke execute on function public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date) from anon;
grant execute on function public.buhrsi_organizer_snapshot(uuid,text),public.buhrsi_log_learning(uuid,integer,uuid,text),public.buhrsi_complete_home_task(uuid,uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date) to authenticated;
