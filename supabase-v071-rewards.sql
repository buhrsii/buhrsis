-- Buhrsi's v0.71: Gaming-Belohnungen und neu gewichtete Schul-XP

alter table public.learning_sessions drop constraint if exists learning_sessions_xp_awarded_check;
alter table public.learning_sessions add constraint learning_sessions_xp_awarded_check check (xp_awarded between 0 and 180);

alter table public.school_grades drop constraint if exists school_grades_xp_awarded_check;
alter table public.school_grades add constraint school_grades_xp_awarded_check check (xp_awarded between 0 and 400);

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  reward_type text not null check (reward_type in ('vbucks','robux','brawl_pass')),
  xp_cost integer not null default 2500 check (xp_cost = 2500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create unique index if not exists reward_requests_one_pending_per_child
  on public.reward_requests(child_id) where status='pending';
create index if not exists reward_requests_child_history
  on public.reward_requests(child_id,requested_at desc);
create index if not exists reward_requests_resolved_by_idx
  on public.reward_requests(resolved_by);

alter table public.reward_requests enable row level security;
revoke all on public.reward_requests from public,anon,authenticated;

create table if not exists public.activity_timers (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  timer_type text not null check (timer_type in ('learning','homework')),
  subject_id uuid references public.school_subjects(id) on delete set null,
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes integer check (minutes between 0 and 240),
  xp_awarded integer not null default 0 check (xp_awarded between 0 and 400),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  learning_session_id uuid references public.learning_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists activity_timers_one_active_kind
  on public.activity_timers(child_id,timer_type) where status='active';
create index if not exists activity_timers_child_history
  on public.activity_timers(child_id,started_at desc);
create index if not exists activity_timers_subject_idx
  on public.activity_timers(subject_id);
create index if not exists activity_timers_learning_session_idx
  on public.activity_timers(learning_session_id);

alter table public.activity_timers enable row level security;
revoke all on public.activity_timers from public,anon,authenticated;

create or replace function private.buhrsi_learning_award(p_minutes integer)
returns integer language sql immutable security invoker set search_path='public','private' as $$
  select case
    when p_minutes<5 then 0
    when p_minutes<10 then 5
    when p_minutes<20 then 10
    when p_minutes<30 then 25
    when p_minutes<45 then 40
    when p_minutes<60 then 65
    else least(180,90+floor((p_minutes-60)/15.0)::integer*25)
  end
$$;
revoke all on function private.buhrsi_learning_award(integer) from public,anon;
grant execute on function private.buhrsi_learning_award(integer) to authenticated;

create or replace function public.buhrsi_log_learning(p_child uuid,p_minutes integer,p_subject uuid default null,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare award integer; new_xp integer; today_count integer;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  if p_minutes<5 or p_minutes>120 then raise exception 'Lernzeit muss zwischen 5 und 120 Minuten liegen'; end if;
  if p_subject is not null and not exists(select 1 from public.school_subjects where id=p_subject and child_id=p_child) then raise exception 'Fach gehört nicht zu diesem Profil'; end if;
  select count(*) into today_count from public.learning_sessions where child_id=p_child and completed_at::date=current_date;
  if today_count>=3 then raise exception 'Heute wurden bereits drei Lernzeiten gespeichert'; end if;
  award:=private.buhrsi_learning_award(p_minutes);
  insert into public.learning_sessions(child_id,subject_id,minutes,xp_awarded) values(p_child,p_subject,p_minutes,award);
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('xp_awarded',award,'xp',new_xp);
end $$;

create or replace function public.buhrsi_add_grade(p_child uuid,p_subject uuid,p_grade numeric,p_category text,p_weight numeric,p_title text,p_graded_on date)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare award integer; row_id uuid; new_xp integer;
begin
  if not exists(select 1 from public.child_profiles where id=p_child and private.is_family_adult(family_id)) then raise exception 'Nur Eltern dürfen Noten eintragen'; end if;
  if p_grade<1 or p_grade>6 then raise exception 'Note muss zwischen 1 und 6 liegen'; end if;
  if not exists(select 1 from public.school_subjects where id=p_subject and child_id=p_child) then raise exception 'Fach gehört nicht zu diesem Profil'; end if;
  award:=case when p_grade<1.5 then 400 when p_grade<2.5 then 200 when p_grade<3.5 then 75 when p_grade<4.5 then 25 else 0 end;
  insert into public.school_grades(child_id,subject_id,grade,category,weight,title,graded_on,xp_awarded)
  values(p_child,p_subject,p_grade,p_category,p_weight,p_title,coalesce(p_graded_on,current_date),award) returning id into row_id;
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('id',row_id,'xp_awarded',award,'xp',new_xp);
end $$;

create or replace function public.buhrsi_rewards_snapshot(p_child uuid,p_token text default null)
returns jsonb language plpgsql stable security definer set search_path='public','private','extensions' as $$
declare result jsonb; is_parent boolean;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  select private.is_family_adult(family_id) into is_parent from public.child_profiles where id=p_child;
  select jsonb_build_object(
    'xp',c.xp,
    'goal',2500,
    'is_parent',coalesce(is_parent,false),
    'sources',jsonb_build_object(
      'brushing',coalesce((select sum(xp_earned) from public.brushing_sessions where child_id=p_child),0),
      'learning',coalesce((select sum(xp_awarded) from public.learning_sessions where child_id=p_child),0),
      'homework',coalesce((select sum(xp_reward) from public.home_tasks where child_id=p_child and completed_at is not null),0)+coalesce((select sum(xp_awarded) from public.activity_timers where child_id=p_child and timer_type='homework' and status='completed'),0),
      'grades',coalesce((select sum(xp_awarded) from public.school_grades where child_id=p_child),0)
    ),
    'pending',(select to_jsonb(r) from public.reward_requests r where r.child_id=p_child and r.status='pending' order by r.requested_at desc limit 1),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.requested_at desc) from (select * from public.reward_requests where child_id=p_child and status<>'pending' order by requested_at desc limit 8) h),'[]'::jsonb)
  ) into result from public.child_profiles c where c.id=p_child;
  return result;
end $$;

create or replace function public.buhrsi_activity_timers_snapshot(p_child uuid,p_token text default null)
returns jsonb language plpgsql stable security definer set search_path='public','private','extensions' as $$
declare result jsonb;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  select jsonb_build_object(
    'active',coalesce((select jsonb_agg(to_jsonb(t) order by t.started_at) from public.activity_timers t where t.child_id=p_child and t.status='active'),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.started_at desc) from (select * from public.activity_timers where child_id=p_child and status='completed' order by started_at desc limit 20) h),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.buhrsi_start_activity_timer(p_child uuid,p_timer_type text,p_subject uuid default null,p_title text default null,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare timer_row public.activity_timers;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  if p_timer_type not in ('learning','homework') then raise exception 'Unbekannter Timer'; end if;
  if p_subject is not null and not exists(select 1 from public.school_subjects where id=p_subject and child_id=p_child) then raise exception 'Fach gehört nicht zu diesem Profil'; end if;
  if exists(select 1 from public.activity_timers where child_id=p_child and timer_type=p_timer_type and status='active') then raise exception 'Dieser Timer läuft bereits'; end if;
  insert into public.activity_timers(child_id,timer_type,subject_id,title)
  values(p_child,p_timer_type,p_subject,nullif(left(trim(p_title),80),'')) returning * into timer_row;
  return to_jsonb(timer_row);
end $$;

create or replace function public.buhrsi_finish_activity_timer(p_child uuid,p_timer uuid,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare timer_row public.activity_timers; duration integer; award integer; new_xp integer; learning_id uuid;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  select * into timer_row from public.activity_timers where id=p_timer and child_id=p_child for update;
  if timer_row.id is null or timer_row.status<>'active' then raise exception 'Timer nicht gefunden oder bereits beendet'; end if;
  duration:=least(240,greatest(0,floor(extract(epoch from (now()-timer_row.started_at))/60)::integer));
  if duration<5 then raise exception 'Mindestens 5 Minuten – der Timer läuft weiter'; end if;
  award:=case when timer_row.timer_type='learning' then private.buhrsi_learning_award(least(duration,120)) else 15 end;
  if timer_row.timer_type='learning' then
    insert into public.learning_sessions(child_id,subject_id,minutes,xp_awarded,completed_at)
    values(p_child,timer_row.subject_id,least(duration,120),award,now()) returning id into learning_id;
  end if;
  update public.activity_timers set ended_at=now(),minutes=duration,xp_awarded=award,status='completed',learning_session_id=learning_id,updated_at=now() where id=p_timer;
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('id',p_timer,'timer_type',timer_row.timer_type,'minutes',duration,'xp_awarded',award,'xp',new_xp,'ended_at',now());
end $$;

create or replace function public.buhrsi_cancel_activity_timer(p_child uuid,p_timer uuid,p_token text default null)
returns void language plpgsql security definer set search_path='public','private','extensions' as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  update public.activity_timers set status='cancelled',ended_at=now(),updated_at=now() where id=p_timer and child_id=p_child and status='active';
  if not found then raise exception 'Timer nicht gefunden oder bereits beendet'; end if;
end $$;

create or replace function public.buhrsi_edit_activity_timer(p_child uuid,p_timer uuid,p_started_at timestamptz,p_ended_at timestamptz)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare timer_row public.activity_timers; duration integer; award integer; difference integer; new_xp integer;
begin
  if not exists(select 1 from public.child_profiles where id=p_child and private.is_family_adult(family_id)) then raise exception 'Nur Eltern dürfen Zeiten korrigieren'; end if;
  select * into timer_row from public.activity_timers where id=p_timer and child_id=p_child and status='completed' for update;
  if timer_row.id is null then raise exception 'Abgeschlossenen Timer nicht gefunden'; end if;
  duration:=floor(extract(epoch from (p_ended_at-p_started_at))/60)::integer;
  if duration<5 or duration>240 then raise exception 'Die Zeit muss zwischen 5 und 240 Minuten liegen'; end if;
  award:=case when timer_row.timer_type='learning' then private.buhrsi_learning_award(least(duration,120)) else 15 end;
  difference:=award-timer_row.xp_awarded;
  update public.activity_timers set started_at=p_started_at,ended_at=p_ended_at,minutes=duration,xp_awarded=award,updated_at=now() where id=p_timer;
  if timer_row.learning_session_id is not null then
    update public.learning_sessions set minutes=least(duration,120),xp_awarded=award,completed_at=p_ended_at where id=timer_row.learning_session_id;
  end if;
  update public.child_profiles set xp=greatest(0,xp+difference),egg_energy=least(200,greatest(0,egg_energy+difference)) where id=p_child returning xp into new_xp;
  return jsonb_build_object('id',p_timer,'minutes',duration,'xp_awarded',award,'xp',new_xp);
end $$;

create or replace function public.buhrsi_family_timer_alerts()
returns jsonb language plpgsql stable security definer set search_path='public','private' as $$
declare fid uuid; result jsonb;
begin
  select family_id into fid from public.family_members where user_id=auth.uid() limit 1;
  if fid is null then raise exception 'Nicht als Elternteil angemeldet'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'child_id',t.child_id,'child_name',c.name,'timer_type',t.timer_type,'title',t.title,'started_at',t.started_at) order by t.started_at desc),'[]'::jsonb)
  into result from public.activity_timers t join public.child_profiles c on c.id=t.child_id
  where c.family_id=fid and t.status='active';
  return result;
end $$;

create or replace function public.buhrsi_request_reward(p_child uuid,p_reward_type text,p_token text default null)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare row_id uuid; current_xp integer;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then raise exception 'Nicht berechtigt'; end if;
  if p_reward_type not in ('vbucks','robux','brawl_pass') then raise exception 'Unbekannte Belohnung'; end if;
  select xp into current_xp from public.child_profiles where id=p_child for update;
  if current_xp<2500 then raise exception 'Dir fehlen noch % XP',2500-current_xp; end if;
  if exists(select 1 from public.reward_requests where child_id=p_child and status='pending') then raise exception 'Eine Belohnung wartet bereits auf Freigabe'; end if;
  insert into public.reward_requests(child_id,reward_type,xp_cost) values(p_child,p_reward_type,2500) returning id into row_id;
  return jsonb_build_object('id',row_id,'status','pending','xp',current_xp);
end $$;

create or replace function public.buhrsi_resolve_reward(p_request uuid,p_approved boolean)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare request_row public.reward_requests; new_xp integer;
begin
  select * into request_row from public.reward_requests where id=p_request for update;
  if request_row.id is null or request_row.status<>'pending' then raise exception 'Anfrage nicht gefunden oder bereits bearbeitet'; end if;
  if not exists(select 1 from public.child_profiles where id=request_row.child_id and private.is_family_adult(family_id)) then raise exception 'Nur Eltern dürfen Belohnungen freigeben'; end if;
  if p_approved then
    update public.child_profiles set xp=xp-request_row.xp_cost where id=request_row.child_id and xp>=request_row.xp_cost returning xp into new_xp;
    if new_xp is null then raise exception 'Nicht genügend XP für diese Belohnung'; end if;
  else
    select xp into new_xp from public.child_profiles where id=request_row.child_id;
  end if;
  update public.reward_requests set status=case when p_approved then 'approved' else 'rejected' end,resolved_at=now(),resolved_by=auth.uid() where id=p_request;
  return jsonb_build_object('id',p_request,'status',case when p_approved then 'approved' else 'rejected' end,'xp',new_xp,'child_id',request_row.child_id);
end $$;

revoke all on function public.buhrsi_log_learning(uuid,integer,uuid,text),public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date),public.buhrsi_rewards_snapshot(uuid,text),public.buhrsi_request_reward(uuid,text,text),public.buhrsi_resolve_reward(uuid,boolean),public.buhrsi_activity_timers_snapshot(uuid,text),public.buhrsi_start_activity_timer(uuid,text,uuid,text,text),public.buhrsi_finish_activity_timer(uuid,uuid,text),public.buhrsi_cancel_activity_timer(uuid,uuid,text),public.buhrsi_edit_activity_timer(uuid,uuid,timestamptz,timestamptz),public.buhrsi_family_timer_alerts() from public,anon,authenticated;
grant execute on function public.buhrsi_log_learning(uuid,integer,uuid,text),public.buhrsi_rewards_snapshot(uuid,text),public.buhrsi_request_reward(uuid,text,text),public.buhrsi_activity_timers_snapshot(uuid,text),public.buhrsi_start_activity_timer(uuid,text,uuid,text,text),public.buhrsi_finish_activity_timer(uuid,uuid,text),public.buhrsi_cancel_activity_timer(uuid,uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date),public.buhrsi_resolve_reward(uuid,boolean),public.buhrsi_edit_activity_timer(uuid,uuid,timestamptz,timestamptz),public.buhrsi_family_timer_alerts() to authenticated;
