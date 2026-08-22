create or replace function public.buhrsi_leaderboard()
returns table(rank bigint, display_name text, xp integer, streak integer)
language sql security definer set search_path=public
as $$
  with ranked as (
    select c.id,c.name,coalesce(c.xp,0) xp,coalesce(c.streak,0) streak,
      dense_rank() over(order by coalesce(c.xp,0) desc,coalesce(c.streak,0) desc,c.id) pos
    from public.child_profiles c
  )
  select r.pos,r.name,r.xp,r.streak from ranked r order by r.pos,r.name limit 100;
$$;
revoke all on function public.buhrsi_leaderboard() from public;
grant execute on function public.buhrsi_leaderboard() to anon, authenticated;
