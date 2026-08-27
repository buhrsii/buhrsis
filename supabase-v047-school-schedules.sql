-- v0.47: Kindbezogene Schulwahl, Unterrichtszeiten und Pausen.
alter table public.school_profiles
  add column if not exists external_school_id text,
  add column if not exists school_address text not null default '',
  add column if not exists school_zip text not null default '',
  add column if not exists school_city text not null default '',
  add column if not exists school_source text not null default 'manual';

alter table public.school_profiles drop constraint if exists school_profiles_source_allowed;
alter table public.school_profiles add constraint school_profiles_source_allowed check (school_source in ('manual','jedeschule'));
alter table public.school_subjects drop constraint if exists school_subjects_color_hex;
alter table public.school_subjects add constraint school_subjects_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$');

create table if not exists public.school_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  entry_type text not null check (entry_type in ('lesson','break')),
  period integer,
  name text not null check (char_length(name) between 1 and 60),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  unique(child_id,period),
  check (ends_at > starts_at),
  check ((entry_type='lesson' and period between 1 and 20) or (entry_type='break' and period is null))
);

create index if not exists school_schedule_entries_child_time_idx on public.school_schedule_entries(child_id,starts_at);
alter table public.school_schedule_entries enable row level security;
drop policy if exists "Family manages organizer" on public.school_schedule_entries;
create policy "Family manages organizer" on public.school_schedule_entries for all to authenticated
using (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)))
with check (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)));
grant select,insert,update,delete on public.school_schedule_entries to authenticated;
revoke all on public.school_schedule_entries from anon;

create or replace function public.buhrsi_organizer_snapshot(p_child uuid,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare is_parent boolean; result jsonb;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  select private.is_family_adult(family_id) into is_parent from public.child_profiles where id=p_child;
  select jsonb_build_object(
    'profile',(select to_jsonb(p) from public.school_profiles p where p.child_id=p_child),
    'subjects',coalesce((select jsonb_agg(to_jsonb(s) order by s.is_major desc,s.name) from public.school_subjects s where s.child_id=p_child),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(case when is_parent then to_jsonb(t) else to_jsonb(t)-'email'-'phone'-'office_hours'-'notes' end order by t.name) from public.school_teachers t where t.child_id=p_child),'[]'::jsonb),
    'timetable',coalesce((select jsonb_agg(to_jsonb(x) order by x.weekday,x.period) from public.school_timetable x where x.child_id=p_child),'[]'::jsonb),
    'schedule',coalesce((select jsonb_agg(to_jsonb(x) order by x.starts_at,x.entry_type) from public.school_schedule_entries x where x.child_id=p_child),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.due_at) from public.school_events e where e.child_id=p_child),'[]'::jsonb),
    'grades',coalesce((select jsonb_agg(to_jsonb(g) order by g.graded_on desc) from public.school_grades g where g.child_id=p_child),'[]'::jsonb),
    'learning',coalesce((select jsonb_agg(to_jsonb(l) order by l.completed_at desc) from (select * from public.learning_sessions where child_id=p_child order by completed_at desc limit 30) l),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(h) order by h.completed_at nulls first,h.due_at nulls last) from public.home_tasks h where h.child_id=p_child),'[]'::jsonb),
    'is_parent',is_parent
  ) into result;
  return result;
end $$;
