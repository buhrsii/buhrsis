-- Einmal vollständig im Supabase SQL Editor ausführen.
alter table public.child_profiles
  add column if not exists perfect_streak integer not null default 0 check (perfect_streak >= 0),
  add column if not exists last_brush_date date,
  add column if not exists last_perfect_date date;

create or replace function public.complete_child_brushing_v024(
  p_child uuid,
  p_pin text,
  p_duration integer default 120
)
returns jsonb
language plpgsql security definer set search_path=public,extensions
as $$
declare
  c public.child_profiles;
  d date := current_date;
  brush_count integer;
  xp_gain integer := 20;
  gloss_gain integer := 3;
  egg_gain integer := 20;
  new_streak integer;
  new_perfect integer;
  became_perfect boolean := false;
begin
  if p_duration < 100 then raise exception 'brushing too short'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'invalid child login'; end if;

  select * into c
  from public.child_profiles
  where id=p_child
    and is_active=true
    and pin_hash=crypt(p_pin,pin_hash)
  for update;
  if not found then raise exception 'invalid child login'; end if;

  select count(*) into brush_count
  from public.brushing_sessions
  where child_id=c.id and completed_at::date=d;

  if c.last_brush_date=d then
    new_streak:=c.streak;
  elsif c.last_brush_date=d-1 then
    new_streak:=c.streak+1;
  else
    new_streak:=1;
  end if;

  if brush_count+1>=2 and c.last_perfect_date is distinct from d then
    became_perfect:=true;
    if c.last_perfect_date=d-1 then new_perfect:=c.perfect_streak+1;
    else new_perfect:=1;
    end if;
  else
    new_perfect:=c.perfect_streak;
  end if;

  insert into public.brushing_sessions(child_id,parent_id,duration_seconds,xp_earned,gloss_earned)
  values(c.id,c.parent_id,least(p_duration,600),xp_gain,gloss_gain);

  update public.child_profiles set
    xp=xp+xp_gain,
    gloss=least(100,gloss+gloss_gain),
    egg_energy=least(100,egg_energy+egg_gain),
    streak=new_streak,
    perfect_streak=new_perfect,
    last_brush_date=d,
    last_perfect_date=case when became_perfect then d else last_perfect_date end
  where id=c.id returning * into c;

  return jsonb_build_object(
    'profile',to_jsonb(c),
    'brushes_today',brush_count+1,
    'perfect_day',(brush_count+1)>=2,
    'became_perfect',became_perfect
  );
end $$;

revoke all on function public.complete_child_brushing_v024(uuid,text,integer) from public;
grant execute on function public.complete_child_brushing_v024(uuid,text,integer) to anon,authenticated;

create or replace function public.reset_child_progress(p_child uuid)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if not exists(
    select 1 from public.child_profiles
    where id=p_child and parent_id=auth.uid()
  ) then
    raise exception 'child not found';
  end if;

  delete from public.brushing_sessions
  where child_id=p_child and parent_id=auth.uid();

  delete from public.buhrsis
  where child_id=p_child and parent_id=auth.uid();

  update public.child_profiles set
    xp=0,
    gloss=0,
    streak=0,
    perfect_streak=0,
    egg_energy=0,
    last_brush_date=null,
    last_perfect_date=null
  where id=p_child and parent_id=auth.uid();
end $$;

revoke all on function public.reset_child_progress(uuid) from public;
grant execute on function public.reset_child_progress(uuid) to authenticated;

create or replace function public.buhrsi_leaderboard()
returns table(rank bigint, display_name text, xp integer, streak integer)
language sql security definer set search_path=public
as $$
  with children as (
    select
      lower(trim(c.name)) as name_key,
      min(trim(c.name)) as display_name,
      max(coalesce(c.xp,0))::integer as xp,
      max(coalesce(c.streak,0))::integer as streak
    from public.child_profiles c
    where c.is_active=true
    group by lower(trim(c.name))
  ), ranked as (
    select
      row_number() over(order by c.xp desc,c.streak desc,c.display_name) as rank,
      c.display_name,
      c.xp,
      c.streak
    from children c
  )
  select r.rank,r.display_name,r.xp,r.streak
  from ranked r
  order by r.rank;
$$;

revoke all on function public.buhrsi_leaderboard() from public;
grant execute on function public.buhrsi_leaderboard() to anon,authenticated;
