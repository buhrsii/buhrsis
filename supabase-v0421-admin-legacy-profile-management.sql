-- Buhrsi v0.42.1: allow the single protected administrator to manage legacy profiles
create or replace function public.delete_child_account(p_child uuid)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not exists (
    select 1 from public.child_profiles
    where id=p_child and (
      parent_id=auth.uid()
      or coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false)
    )
  ) then raise exception 'child not found'; end if;
  delete from public.child_profiles where id=p_child;
end
$$;

create or replace function public.reset_child_pin(p_child uuid,p_pin text)
returns void language plpgsql security definer set search_path='public','extensions'
as $$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must have 4 digits'; end if;
  update public.child_profiles
  set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf'))
  where id=p_child and (
    parent_id=auth.uid()
    or coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false)
  );
  if not found then raise exception 'child not found'; end if;
end
$$;

create or replace function public.reset_child_progress(p_child uuid)
returns void language plpgsql security definer set search_path='public'
as $$
begin
  if not exists (
    select 1 from public.child_profiles
    where id=p_child and (
      parent_id=auth.uid()
      or coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false)
    )
  ) then raise exception 'child not found'; end if;
  delete from public.brushing_sessions where child_id=p_child;
  delete from public.buhrsis where child_id=p_child;
  update public.child_profiles set
    xp=0,gloss=0,streak=0,perfect_streak=0,egg_energy=0,
    last_brush_date=null,last_perfect_date=null
  where id=p_child;
end
$$;

revoke all on function public.delete_child_account(uuid) from public,anon;
revoke all on function public.reset_child_pin(uuid,text) from public,anon;
revoke all on function public.reset_child_progress(uuid) from public,anon;
grant execute on function public.delete_child_account(uuid) to authenticated;
grant execute on function public.reset_child_pin(uuid,text) to authenticated;
grant execute on function public.reset_child_progress(uuid) to authenticated;
