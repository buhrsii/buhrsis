
create or replace function public.reset_child_progress(p_child uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.child_profiles where id=p_child and parent_id=auth.uid()) then
   raise exception 'child not found';
 end if;
 delete from public.brushing_sessions where child_id=p_child and parent_id=auth.uid();
 delete from public.buhrsis where child_id=p_child and parent_id=auth.uid();
 update public.child_profiles set
   xp=0, gloss=50, streak=0, perfect_streak=0, egg_energy=0,
   last_brush_date=null, last_perfect_date=null
 where id=p_child and parent_id=auth.uid();
end $$;

create or replace function public.delete_child_account(p_child uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 delete from public.child_profiles where id=p_child and parent_id=auth.uid();
 if not found then raise exception 'child not found'; end if;
end $$;

revoke all on function public.reset_child_progress(uuid) from public;
grant execute on function public.reset_child_progress(uuid) to authenticated;
revoke all on function public.delete_child_account(uuid) from public;
grant execute on function public.delete_child_account(uuid) to authenticated;
