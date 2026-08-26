-- Buhrsi's v0.29 – dauerhafte Kinder-Anmeldung ohne gespeicherte PIN

create table if not exists public.buhrsi_child_device_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '180 days',
  last_used_at timestamptz not null default now()
);
create index if not exists buhrsi_child_device_sessions_child_idx on public.buhrsi_child_device_sessions(child_id);
alter table public.buhrsi_child_device_sessions enable row level security;
revoke all on public.buhrsi_child_device_sessions from anon, authenticated;

create or replace function public.buhrsi_create_child_device_session(p_child uuid, p_pin text)
returns text language plpgsql security definer set search_path=public,extensions as $$
declare raw_token text;
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  raw_token := encode(gen_random_bytes(32),'hex');
  insert into public.buhrsi_child_device_sessions(child_id,token_hash)
  values(p_child, encode(digest(raw_token,'sha256'),'hex'));
  return raw_token;
end $$;

create or replace function public.buhrsi_restore_child_device_session(p_token text)
returns table(id uuid,name text,username text,buhrsi_code text,xp integer,gloss integer,streak integer,egg_energy integer)
language plpgsql security definer set search_path=public,extensions as $$
declare sess public.buhrsi_child_device_sessions;
begin
  select * into sess from public.buhrsi_child_device_sessions
  where token_hash=encode(digest(p_token,'sha256'),'hex') and expires_at>now() limit 1;
  if not found then return; end if;
  update public.buhrsi_child_device_sessions set last_used_at=now(),expires_at=now()+interval '180 days' where id=sess.id;
  return query select c.id,c.name,c.username,c.buhrsi_code,coalesce(c.xp,0),coalesce(c.gloss,0),coalesce(c.streak,0),coalesce(c.egg_energy,0)
  from public.child_profiles c where c.id=sess.child_id and c.is_active=true;
end $$;

create or replace function public.buhrsi_revoke_child_device_session(p_token text)
returns void language sql security definer set search_path=public,extensions as $$
  delete from public.buhrsi_child_device_sessions where token_hash=encode(digest(p_token,'sha256'),'hex');
$$;

create or replace function public.buhrsi_social_authorized(p_child uuid, p_pin text default null)
returns boolean language sql security definer set search_path=public,extensions stable as $$
  select exists(
    select 1 from public.child_profiles c
    where c.id=p_child and c.is_active=true and (
      c.parent_id=auth.uid()
      or (p_pin is not null and p_pin ~ '^[0-9]{4}$' and c.pin_hash=crypt(p_pin,c.pin_hash))
      or (p_pin is not null and length(p_pin)>=32 and exists(
        select 1 from public.buhrsi_child_device_sessions s
        where s.child_id=c.id and s.token_hash=encode(digest(p_pin,'sha256'),'hex') and s.expires_at>now()
      ))
    )
  );
$$;

create or replace function public.complete_child_brushing_v024(p_child uuid,p_pin text,p_duration integer default 120)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare c public.child_profiles; d date:=current_date; brush_count integer; xp_gain integer:=20; gloss_gain integer:=3; egg_gain integer:=20; new_streak integer; new_perfect integer; became_perfect boolean:=false;
begin
  if p_duration<100 then raise exception 'brushing too short'; end if;
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'invalid child login'; end if;
  select * into c from public.child_profiles where id=p_child and is_active=true for update;
  if not found then raise exception 'invalid child login'; end if;
  select count(*) into brush_count from public.brushing_sessions where child_id=c.id and completed_at::date=d;
  if c.last_brush_date=d then new_streak:=c.streak; elsif c.last_brush_date=d-1 then new_streak:=c.streak+1; else new_streak:=1; end if;
  if brush_count+1>=2 and c.last_perfect_date is distinct from d then became_perfect:=true; if c.last_perfect_date=d-1 then new_perfect:=c.perfect_streak+1; else new_perfect:=1; end if; else new_perfect:=c.perfect_streak; end if;
  insert into public.brushing_sessions(child_id,parent_id,duration_seconds,xp_earned,gloss_earned) values(c.id,c.parent_id,least(p_duration,600),xp_gain,gloss_gain);
  update public.child_profiles set xp=xp+xp_gain,gloss=least(100,gloss+gloss_gain),egg_energy=least(100,egg_energy+egg_gain),streak=new_streak,perfect_streak=new_perfect,last_brush_date=d,last_perfect_date=case when became_perfect then d else last_perfect_date end where id=c.id returning * into c;
  return jsonb_build_object('profile',to_jsonb(c),'brushes_today',brush_count+1,'perfect_day',(brush_count+1)>=2,'became_perfect',became_perfect);
end $$;

revoke all on function public.buhrsi_create_child_device_session(uuid,text) from public;
revoke all on function public.buhrsi_restore_child_device_session(text) from public;
revoke all on function public.buhrsi_revoke_child_device_session(text) from public;
grant execute on function public.buhrsi_create_child_device_session(uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_restore_child_device_session(text) to anon,authenticated;
grant execute on function public.buhrsi_revoke_child_device_session(text) to anon,authenticated;
