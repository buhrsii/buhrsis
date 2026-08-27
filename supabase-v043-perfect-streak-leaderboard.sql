-- Buhrsi v0.43: expose Perfect Streak in the public leaderboard
drop function if exists public.buhrsi_leaderboard();
create function public.buhrsi_leaderboard()
returns table(rank bigint,display_name text,xp integer,streak integer,perfect_streak integer)
language sql security definer set search_path='public'
as $$
  with profiles as (
    select lower(trim(c.name)) as name_key,min(trim(c.name)) as display_name,
      max(coalesce(c.xp,0))::integer as xp,
      max(coalesce(c.streak,0))::integer as streak,
      max(coalesce(c.perfect_streak,0))::integer as perfect_streak
    from public.child_profiles c
    where c.is_active=true
    group by lower(trim(c.name))
  ), ranked as (
    select row_number() over(order by p.xp desc,p.perfect_streak desc,p.streak desc,p.display_name) as rank,
      p.display_name,p.xp,p.streak,p.perfect_streak
    from profiles p
  )
  select r.rank,r.display_name,r.xp,r.streak,r.perfect_streak from ranked r order by r.rank
$$;
revoke all on function public.buhrsi_leaderboard() from public;
grant execute on function public.buhrsi_leaderboard() to anon,authenticated;
