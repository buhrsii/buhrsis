-- Buhrsi's v0.27 – sichere Freundschaften + Live-Putzstatus
-- Einmal vollständig im Supabase SQL Editor ausführen.

create table if not exists public.buhrsi_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.child_profiles(id) on delete cascade,
  addressee_id uuid not null references public.child_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index if not exists buhrsi_friendship_pair_unique
on public.buhrsi_friendships (
  least(requester_id::text, addressee_id::text),
  greatest(requester_id::text, addressee_id::text)
);

create table if not exists public.buhrsi_child_activity (
  child_id uuid primary key references public.child_profiles(id) on delete cascade,
  is_brushing boolean not null default false,
  brushing_started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.buhrsi_friendships enable row level security;
alter table public.buhrsi_child_activity enable row level security;
revoke all on public.buhrsi_friendships from anon, authenticated;
revoke all on public.buhrsi_child_activity from anon, authenticated;

create or replace function public.buhrsi_social_authorized(p_child uuid, p_pin text default null)
returns boolean
language sql security definer set search_path=public,extensions
stable
as $$
  select exists(
    select 1 from public.child_profiles c
    where c.id=p_child and c.is_active=true
      and (
        c.parent_id=auth.uid()
        or (p_pin is not null and p_pin ~ '^[0-9]{4}$' and c.pin_hash=crypt(p_pin,c.pin_hash))
      )
  );
$$;

revoke all on function public.buhrsi_social_authorized(uuid,text) from public;

create or replace function public.buhrsi_social_send_request(p_child uuid, p_code text, p_pin text default null)
returns jsonb
language plpgsql security definer set search_path=public,extensions
as $$
declare target_id uuid; existing public.buhrsi_friendships;
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  select id into target_id from public.child_profiles
   where is_active=true and lower(trim(buhrsi_code))=lower(trim(p_code)) limit 1;
  if target_id is null then raise exception 'Freundescode nicht gefunden'; end if;
  if target_id=p_child then raise exception 'Du kannst dich nicht selbst hinzufügen'; end if;

  select * into existing from public.buhrsi_friendships
   where (requester_id=p_child and addressee_id=target_id)
      or (requester_id=target_id and addressee_id=p_child)
   limit 1;
  if found then
    if existing.status='accepted' then return jsonb_build_object('ok',true,'already_friends',true); end if;
    if existing.addressee_id=p_child then
      update public.buhrsi_friendships set status='accepted',accepted_at=now() where id=existing.id;
      return jsonb_build_object('ok',true,'accepted',true);
    end if;
    return jsonb_build_object('ok',true,'pending',true);
  end if;

  insert into public.buhrsi_friendships(requester_id,addressee_id) values(p_child,target_id);
  return jsonb_build_object('ok',true,'pending',true);
end $$;

create or replace function public.buhrsi_social_accept_request(p_child uuid, p_request uuid, p_pin text default null)
returns boolean
language plpgsql security definer set search_path=public,extensions
as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  update public.buhrsi_friendships
     set status='accepted',accepted_at=now()
   where id=p_request and addressee_id=p_child and status='pending';
  return found;
end $$;

create or replace function public.buhrsi_social_list(p_child uuid, p_pin text default null)
returns table(friend_id uuid, display_name text, username text, buhrsi_code text, xp integer, streak integer, is_brushing boolean, brushing_started_at timestamptz)
language plpgsql security definer set search_path=public,extensions
as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  return query
  select c.id,c.name,c.username,c.buhrsi_code,coalesce(c.xp,0),coalesce(c.streak,0),
         case when a.updated_at > now()-interval '4 minutes' then coalesce(a.is_brushing,false) else false end,
         a.brushing_started_at
  from public.buhrsi_friendships f
  join public.child_profiles c on c.id=case when f.requester_id=p_child then f.addressee_id else f.requester_id end
  left join public.buhrsi_child_activity a on a.child_id=c.id
  where f.status='accepted' and (f.requester_id=p_child or f.addressee_id=p_child) and c.is_active=true
  order by (case when a.updated_at > now()-interval '4 minutes' then coalesce(a.is_brushing,false) else false end) desc,c.name;
end $$;

create or replace function public.buhrsi_social_requests(p_child uuid, p_pin text default null)
returns table(request_id uuid, child_id uuid, display_name text, username text)
language plpgsql security definer set search_path=public,extensions
as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  return query
  select f.id,c.id,c.name,c.username
  from public.buhrsi_friendships f
  join public.child_profiles c on c.id=f.requester_id
  where f.addressee_id=p_child and f.status='pending' and c.is_active=true
  order by f.created_at desc;
end $$;

create or replace function public.buhrsi_social_set_brushing(p_child uuid, p_brushing boolean, p_pin text default null)
returns boolean
language plpgsql security definer set search_path=public,extensions
as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  insert into public.buhrsi_child_activity(child_id,is_brushing,brushing_started_at,updated_at)
  values(p_child,p_brushing,case when p_brushing then now() else null end,now())
  on conflict(child_id) do update set
    is_brushing=excluded.is_brushing,
    brushing_started_at=case when excluded.is_brushing then coalesce(public.buhrsi_child_activity.brushing_started_at,now()) else null end,
    updated_at=now();
  return true;
end $$;

revoke all on function public.buhrsi_social_send_request(uuid,text,text) from public;
revoke all on function public.buhrsi_social_accept_request(uuid,uuid,text) from public;
revoke all on function public.buhrsi_social_list(uuid,text) from public;
revoke all on function public.buhrsi_social_requests(uuid,text) from public;
revoke all on function public.buhrsi_social_set_brushing(uuid,boolean,text) from public;
grant execute on function public.buhrsi_social_send_request(uuid,text,text) to anon,authenticated;
grant execute on function public.buhrsi_social_accept_request(uuid,uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_social_list(uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_social_requests(uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_social_set_brushing(uuid,boolean,text) to anon,authenticated;
