
create extension if not exists pgcrypto;

alter table public.child_profiles
  add column if not exists username text,
  add column if not exists pin_hash text,
  add column if not exists buhrsi_code text,
  add column if not exists is_active boolean not null default true;

create unique index if not exists child_profiles_username_unique
on public.child_profiles (lower(username)) where username is not null;

create unique index if not exists child_profiles_code_unique
on public.child_profiles (buhrsi_code) where buhrsi_code is not null;

create or replace function public.create_child_account(p_name text, p_username text, p_pin text)
returns public.child_profiles
language plpgsql security definer set search_path=public
as $$
declare r public.child_profiles; u text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 u:=lower(trim(p_username));
 if char_length(u)<3 or char_length(u)>20 or u !~ '^[a-z0-9_]+$' then raise exception 'invalid username'; end if;
 if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must have 4 digits'; end if;
 insert into public.child_profiles(parent_id,name,username,pin_hash,buhrsi_code)
 values(auth.uid(),left(trim(p_name),30),u,crypt(p_pin,gen_salt('bf')),
        'BUR-'||upper(substr(md5(gen_random_uuid()::text),1,6)))
 returning * into r;
 return r;
end $$;

create or replace function public.reset_child_pin(p_child uuid, p_pin text)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must have 4 digits'; end if;
 update public.child_profiles set pin_hash=crypt(p_pin,gen_salt('bf'))
 where id=p_child and parent_id=auth.uid();
 if not found then raise exception 'child not found'; end if;
end $$;

-- Child login verification deliberately returns only the child id/profile data needed by the app.
-- This is a prototype RPC. For production, move child sessions to a server-side endpoint with
-- rate limiting and signed short-lived session tokens.
create or replace function public.verify_child_pin(p_username text, p_pin text)
returns table(id uuid,name text,username text,buhrsi_code text,xp int,gloss int,streak int,egg_energy int)
language sql security definer set search_path=public
as $$
 select c.id,c.name,c.username,c.buhrsi_code,c.xp,c.gloss,c.streak,c.egg_energy
 from public.child_profiles c
 where lower(c.username)=lower(trim(p_username))
   and c.is_active=true and c.pin_hash=crypt(p_pin,c.pin_hash)
 limit 1
$$;

revoke all on function public.create_child_account(text,text,text) from public;
grant execute on function public.create_child_account(text,text,text) to authenticated;
revoke all on function public.reset_child_pin(uuid,text) from public;
grant execute on function public.reset_child_pin(uuid,text) to authenticated;
grant execute on function public.verify_child_pin(text,text) to anon,authenticated;
