create or replace function public.buhrsi_parent_add_activity(
  p_child uuid,
  p_timer_type text,
  p_subject uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path='public','private','extensions'
as $$
declare
  duration integer;
  award integer;
  new_xp integer;
  learning_id uuid;
  timer_id uuid;
begin
  if not exists(
    select 1 from public.child_profiles
    where id=p_child and private.is_family_adult(family_id)
  ) then
    raise exception 'Nur Eltern dürfen Aktivitäten nachtragen';
  end if;

  if p_timer_type not in ('learning','homework') then
    raise exception 'Unbekannte Aktivität';
  end if;
  if p_subject is null or not exists(
    select 1 from public.school_subjects where id=p_subject and child_id=p_child
  ) then
    raise exception 'Bitte ein gültiges Fach auswählen';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at>now()+interval '5 minutes' then
    raise exception 'Bitte gültige Zeiten in der Vergangenheit eingeben';
  end if;

  duration:=floor(extract(epoch from (p_ended_at-p_started_at))/60)::integer;
  if duration<5 or duration>240 then
    raise exception 'Die Zeit muss zwischen 5 und 240 Minuten liegen';
  end if;

  award:=case
    when p_timer_type='learning' then private.buhrsi_learning_award(least(duration,120))
    else 15
  end;

  if p_timer_type='learning' then
    insert into public.learning_sessions(child_id,subject_id,minutes,xp_awarded,completed_at)
    values(p_child,p_subject,least(duration,120),award,p_ended_at)
    returning id into learning_id;
  end if;

  insert into public.activity_timers(
    child_id,timer_type,subject_id,title,started_at,ended_at,minutes,
    xp_awarded,status,learning_session_id,updated_at
  ) values(
    p_child,p_timer_type,p_subject,nullif(left(trim(p_title),80),''),
    p_started_at,p_ended_at,duration,award,'completed',learning_id,now()
  ) returning id into timer_id;

  update public.child_profiles
  set xp=xp+award,egg_energy=least(200,egg_energy+award)
  where id=p_child
  returning xp into new_xp;

  return jsonb_build_object(
    'id',timer_id,
    'timer_type',p_timer_type,
    'minutes',duration,
    'xp_awarded',award,
    'xp',new_xp
  );
end
$$;

revoke all on function public.buhrsi_parent_add_activity(uuid,text,uuid,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.buhrsi_parent_add_activity(uuid,text,uuid,timestamptz,timestamptz,text) to authenticated;
