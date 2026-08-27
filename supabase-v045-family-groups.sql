-- Familiengruppen mit mehreren Elternteilen
create schema if not exists private;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'parent' check (role in ('owner','parent')),
  joined_at timestamptz not null default now(),
  primary key(family_id,user_id),
  unique(user_id)
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
revoke all on public.families,public.family_members from anon,authenticated;

alter table public.child_profiles add column if not exists family_id uuid references public.families(id) on delete restrict;
create index if not exists child_profiles_family_idx on public.child_profiles(family_id);
create index if not exists family_members_user_idx on public.family_members(user_id);

-- Vorhandene Eltern und Kinder ohne Datenverlust in eigene Familien übernehmen.
do $$
declare r record; fid uuid; code text;
begin
  for r in select distinct parent_id from public.child_profiles where family_id is null and parent_id is not null loop
    code:=upper(substr(md5(r.parent_id::text||clock_timestamp()::text||random()::text),1,8));
    insert into public.families(name,invite_code,owner_id)
    values('Meine Familie',code,r.parent_id) returning id into fid;
    insert into public.family_members(family_id,user_id,role) values(fid,r.parent_id,'owner') on conflict do nothing;
    update public.child_profiles set family_id=fid where parent_id=r.parent_id and family_id is null;
  end loop;
end $$;

create or replace function private.is_family_adult(p_family uuid)
returns boolean language sql stable security definer set search_path='public','private' as $$
  select auth.uid() is not null and exists(
    select 1 from public.family_members m where m.family_id=p_family and m.user_id=auth.uid()
  );
$$;
revoke all on function private.is_family_adult(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_family_adult(uuid) to authenticated;

create or replace function private.family_status()
returns jsonb language plpgsql stable security definer set search_path='public','private','auth' as $$
declare fid uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from public.family_members where user_id=auth.uid() limit 1;
  if fid is null then return null; end if;
  select jsonb_build_object(
    'id',f.id,'name',f.name,'invite_code',f.invite_code,
    'role',(select m.role from public.family_members m where m.family_id=f.id and m.user_id=auth.uid()),
    'adults',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'email',u.email) order by m.joined_at) from public.family_members m join auth.users u on u.id=m.user_id where m.family_id=f.id),'[]'::jsonb)
  ) into result from public.families f where f.id=fid;
  return result;
end $$;

create or replace function private.create_family(p_name text)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare fid uuid; code text;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Du bist bereits in einer Familie'; end if;
  if char_length(trim(p_name))<1 or char_length(trim(p_name))>60 then raise exception 'Bitte einen Familiennamen eingeben'; end if;
  loop
    code:=upper(substr(md5(gen_random_uuid()::text||random()::text),1,8));
    exit when not exists(select 1 from public.families where invite_code=code);
  end loop;
  insert into public.families(name,invite_code,owner_id) values(trim(p_name),code,auth.uid()) returning id into fid;
  insert into public.family_members(family_id,user_id,role) values(fid,auth.uid(),'owner');
  return private.family_status();
end $$;

create or replace function private.join_family(p_code text)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare fid uuid; member_count integer;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Du bist bereits in einer Familie'; end if;
  select id into fid from public.families where invite_code=upper(trim(p_code)) for update;
  if fid is null then raise exception 'Familiencode nicht gefunden'; end if;
  select count(*) into member_count from public.family_members where family_id=fid;
  if member_count>=4 then raise exception 'Diese Familie hat bereits vier Elternzugänge'; end if;
  insert into public.family_members(family_id,user_id,role) values(fid,auth.uid(),'parent');
  return private.family_status();
end $$;

revoke all on function private.family_status(),private.create_family(text),private.join_family(text) from public,anon;
grant execute on function private.family_status(),private.create_family(text),private.join_family(text) to authenticated;

create or replace function public.buhrsi_family_status() returns jsonb language sql security invoker set search_path='public','private' as $$select private.family_status()$$;
create or replace function public.buhrsi_family_create(p_name text) returns jsonb language sql security invoker set search_path='public','private' as $$select private.create_family(p_name)$$;
create or replace function public.buhrsi_family_join(p_code text) returns jsonb language sql security invoker set search_path='public','private' as $$select private.join_family(p_code)$$;
revoke all on function public.buhrsi_family_status(),public.buhrsi_family_create(text),public.buhrsi_family_join(text) from public,anon;
grant execute on function public.buhrsi_family_status(),public.buhrsi_family_create(text),public.buhrsi_family_join(text) to authenticated;

-- Elternrechte auf alle Erwachsenen der Familie erweitern.
drop policy if exists own_select on public.child_profiles;
drop policy if exists own_insert on public.child_profiles;
drop policy if exists own_update on public.child_profiles;
drop policy if exists own_delete on public.child_profiles;
create policy family_select on public.child_profiles for select to authenticated using (private.is_family_adult(family_id));
create policy family_insert on public.child_profiles for insert to authenticated with check (private.is_family_adult(family_id) and parent_id=auth.uid());
create policy family_update on public.child_profiles for update to authenticated using (private.is_family_adult(family_id)) with check (private.is_family_adult(family_id));
create policy family_delete on public.child_profiles for delete to authenticated using (private.is_family_adult(family_id));

drop policy if exists own_sessions on public.brushing_sessions;
create policy family_sessions on public.brushing_sessions for all to authenticated
using (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)))
with check (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)));

drop policy if exists parents_select_own_buhrsis on public.buhrsis;
drop policy if exists parents_insert_own_buhrsis on public.buhrsis;
drop policy if exists parents_update_own_buhrsis on public.buhrsis;
create policy family_buhrsis on public.buhrsis for all to authenticated
using (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)))
with check (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)));

do $$ declare t text; begin
  foreach t in array array['school_profiles','school_subjects','school_teachers','school_timetable','school_events','school_grades','learning_sessions','home_tasks'] loop
    execute format('drop policy if exists "Parents manage organizer" on public.%I',t);
    execute format('create policy "Family manages organizer" on public.%I for all to authenticated using (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id))) with check (exists(select 1 from public.child_profiles c where c.id=child_id and private.is_family_adult(c.family_id)))',t);
  end loop;
end $$;

create or replace function public.buhrsi_social_authorized(p_child uuid,p_pin text default null)
returns boolean language sql stable security definer set search_path='public','private','extensions' as $$
  select exists(
    select 1 from public.child_profiles c where c.id=p_child and c.is_active=true and (
      private.is_family_adult(c.family_id)
      or (p_pin is not null and p_pin ~ '^[0-9]{4}$' and c.pin_hash=crypt(p_pin,c.pin_hash))
      or (p_pin is not null and length(p_pin)>=32 and exists(select 1 from public.buhrsi_child_device_sessions s where s.child_id=c.id and s.token_hash=encode(digest(p_pin,'sha256'),'hex') and s.expires_at>now()))
    )
  );
$$;

create or replace function public.create_child_account(p_name text,p_username text,p_pin text)
returns public.child_profiles language plpgsql security definer set search_path='public','private','extensions' as $$
declare r public.child_profiles; u text; fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from public.family_members where user_id=auth.uid() limit 1;
  if fid is null then raise exception 'Bitte zuerst eine Familiengruppe erstellen'; end if;
  u:=lower(trim(p_username));
  if char_length(u)<3 or char_length(u)>20 or u !~ '^[a-z0-9_]+$' then raise exception 'Ungültiger Benutzername'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN muss aus vier Ziffern bestehen'; end if;
  insert into public.child_profiles(parent_id,family_id,name,username,pin_hash,buhrsi_code)
  values(auth.uid(),fid,left(trim(p_name),30),u,extensions.crypt(p_pin,extensions.gen_salt('bf')),'BUR-'||upper(substr(md5(gen_random_uuid()::text),1,6))) returning * into r;
  return r;
end $$;

create or replace function public.reset_child_pin(p_child uuid,p_pin text) returns void language plpgsql security definer set search_path='public','private','extensions' as $$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN muss aus vier Ziffern bestehen'; end if;
  update public.child_profiles set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf')) where id=p_child and (private.is_family_adult(family_id) or coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false));
  if not found then raise exception 'Kinderprofil nicht gefunden'; end if;
end $$;

create or replace function public.delete_child_account(p_child uuid) returns void language plpgsql security definer set search_path='public','private' as $$
begin
  if not exists(select 1 from public.child_profiles where id=p_child and (private.is_family_adult(family_id) or coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false))) then raise exception 'Kinderprofil nicht gefunden'; end if;
  delete from public.child_profiles where id=p_child;
end $$;

create or replace function public.reset_child_progress(p_child uuid) returns void language plpgsql security definer set search_path='public','private' as $$
begin
  if not exists(select 1 from public.child_profiles where id=p_child and (private.is_family_adult(family_id) or coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false))) then raise exception 'Kinderprofil nicht gefunden'; end if;
  delete from public.brushing_sessions where child_id=p_child;
  delete from public.buhrsis where child_id=p_child;
  update public.child_profiles set xp=0,gloss=0,streak=0,perfect_streak=0,egg_energy=0,last_brush_date=null,last_perfect_date=null where id=p_child;
end $$;

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
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.due_at) from public.school_events e where e.child_id=p_child),'[]'::jsonb),
    'grades',coalesce((select jsonb_agg(to_jsonb(g) order by g.graded_on desc) from public.school_grades g where g.child_id=p_child),'[]'::jsonb),
    'learning',coalesce((select jsonb_agg(to_jsonb(l) order by l.completed_at desc) from (select * from public.learning_sessions where child_id=p_child order by completed_at desc limit 30) l),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(to_jsonb(h) order by h.completed_at nulls first,h.due_at nulls last) from public.home_tasks h where h.child_id=p_child),'[]'::jsonb),
    'is_parent',is_parent
  ) into result;
  return result;
end $$;

create or replace function public.buhrsi_add_grade(p_child uuid,p_subject uuid,p_grade numeric,p_category text,p_weight numeric,p_title text,p_graded_on date)
returns jsonb language plpgsql security definer set search_path='public','private','extensions' as $$
declare award integer; row_id uuid; new_xp integer;
begin
  if not exists(select 1 from public.child_profiles where id=p_child and private.is_family_adult(family_id)) then raise exception 'Nur Eltern dürfen Noten eintragen'; end if;
  if p_grade<1 or p_grade>6 then raise exception 'Note muss zwischen 1 und 6 liegen'; end if;
  if not exists(select 1 from public.school_subjects where id=p_subject and child_id=p_child) then raise exception 'Fach gehört nicht zu diesem Profil'; end if;
  award:=case when p_grade<1.5 then 50 when p_grade<2.5 then 40 when p_grade<3.5 then 30 when p_grade<4.5 then 20 when p_grade<5.5 then 10 else 5 end;
  insert into public.school_grades(child_id,subject_id,grade,category,weight,title,graded_on,xp_awarded) values(p_child,p_subject,p_grade,p_category,p_weight,p_title,coalesce(p_graded_on,current_date),award) returning id into row_id;
  update public.child_profiles set xp=xp+award,egg_energy=least(200,egg_energy+award) where id=p_child returning xp into new_xp;
  return jsonb_build_object('id',row_id,'xp_awarded',award,'xp',new_xp);
end $$;

create or replace function public.feed_buhrsi_brush_xp(p_child uuid) returns void language plpgsql security definer set search_path='public','private' as $$
begin
  if not exists(select 1 from public.child_profiles where id=p_child and private.is_family_adult(family_id)) then raise exception 'Kinderprofil nicht gefunden'; end if;
  update public.buhrsis set xp=xp+10,bond=least(100,bond+1),gloss=least(100,gloss+1) where child_id=p_child;
end $$;

create or replace function public.update_buhrsi_values(p_child uuid) returns setof public.buhrsis language plpgsql security definer set search_path='public','private' as $$
begin
  if not exists(select 1 from public.child_profiles where id=p_child and private.is_family_adult(family_id)) then raise exception 'Kinderprofil nicht gefunden'; end if;
  update public.buhrsis b set care_score=greatest(0,least(100,b.care_score+case when exists(select 1 from public.brushing_sessions s where s.child_id=p_child and s.completed_at::date=current_date) then 2 else -3 end)),last_care_date=current_date where b.child_id=p_child and (b.last_care_date is null or b.last_care_date<current_date);
  update public.buhrsis b set current_value=greatest(1,round(b.base_value*(0.70+b.care_score::numeric/200))::int),stage=case when b.xp>=500 then 3 when b.xp>=150 then 2 else 1 end where b.child_id=p_child;
  return query select * from public.buhrsis where child_id=p_child order by born_at desc;
end $$;

-- Die vorhandene umfangreiche Schlüpf-Logik behält ihre Zufallsverteilung,
-- prüft aber künftig die Familienmitgliedschaft statt nur den Ersteller.
do $$ declare def text; begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='hatch_ready_egg' limit 1;
  if def is not null and position('and parent_id = auth.uid()' in def)>0 then
    def:=replace(def,'and parent_id = auth.uid()','and private.is_family_adult(family_id)');
    execute def;
  end if;
end $$;

revoke all on function public.create_child_account(text,text,text),public.reset_child_pin(uuid,text),public.delete_child_account(uuid),public.reset_child_progress(uuid),public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date),public.feed_buhrsi_brush_xp(uuid),public.update_buhrsi_values(uuid) from public,anon;
grant execute on function public.create_child_account(text,text,text),public.reset_child_pin(uuid,text),public.delete_child_account(uuid),public.reset_child_progress(uuid),public.buhrsi_add_grade(uuid,uuid,numeric,text,numeric,text,date),public.feed_buhrsi_brush_xp(uuid),public.update_buhrsi_values(uuid) to authenticated;
