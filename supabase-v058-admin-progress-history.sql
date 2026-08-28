-- Buhrsi v0.58: zuverlässige Adminrechte und Putzverlauf

create or replace function private.is_buhrsi_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and coalesce((u.raw_app_meta_data->>'buhrsi_admin')::boolean,false)
  )
$$;

revoke all on function private.is_buhrsi_admin() from public, anon;
grant execute on function private.is_buhrsi_admin() to authenticated;

create or replace function public.buhrsi_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = private
as $$
  select private.is_buhrsi_admin()
$$;

revoke all on function public.buhrsi_is_admin() from public, anon;
grant execute on function public.buhrsi_is_admin() to authenticated;

drop policy if exists admin_select_all_children on public.child_profiles;
create policy admin_select_all_children on public.child_profiles
for select to authenticated
using ((select private.is_buhrsi_admin()));

drop policy if exists admin_update_all_children on public.child_profiles;
create policy admin_update_all_children on public.child_profiles
for update to authenticated
using ((select private.is_buhrsi_admin()))
with check ((select private.is_buhrsi_admin()));

drop policy if exists admin_select_brushing_sessions on public.brushing_sessions;
create policy admin_select_brushing_sessions on public.brushing_sessions
for select to authenticated
using ((select private.is_buhrsi_admin()));

create or replace function public.buhrsi_social_authorized(p_child uuid,p_pin text default null)
returns boolean
language sql
stable
security definer
set search_path = 'public','private','extensions'
as $$
  select exists(
    select 1
    from public.child_profiles c
    where c.id=p_child and c.is_active=true and (
      private.is_buhrsi_admin()
      or private.is_family_adult(c.family_id)
      or (p_pin is not null and p_pin ~ '^[0-9]{4}$' and c.pin_hash=crypt(p_pin,c.pin_hash))
      or (p_pin is not null and length(p_pin)>=32 and exists(
        select 1 from public.buhrsi_child_device_sessions s
        where s.child_id=c.id
          and s.token_hash=encode(digest(p_pin,'sha256'),'hex')
          and s.expires_at>now()
      ))
    )
  )
$$;
