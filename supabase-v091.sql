
alter table public.child_profiles
  add column if not exists perfect_streak integer not null default 0 check (perfect_streak >= 0),
  add column if not exists last_brush_date date,
  add column if not exists last_perfect_date date;

create or replace function public.complete_brushing_v091(p_child uuid, p_duration integer default 120)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
 c public.child_profiles;
 d date := current_date;
 brush_count integer;
 xp_gain integer := 20;
 gloss_gain integer := 3;
 egg_gain integer := 20;
 new_streak integer;
 new_perfect integer;
 became_perfect boolean := false;
begin
 if p_duration < 100 then raise exception 'brushing too short'; end if;

 select * into c from public.child_profiles
 where id=p_child and parent_id=auth.uid() for update;
 if not found then raise exception 'child not found'; end if;

 select count(*) into brush_count
 from public.brushing_sessions
 where child_id=c.id and completed_at::date=d;

 -- Daily streak: one or more qualifying sessions keeps/advances it.
 if c.last_brush_date = d then
   new_streak := c.streak;
 elsif c.last_brush_date = d - 1 then
   new_streak := c.streak + 1;
 else
   new_streak := 1;
 end if;

 -- The session we are about to insert makes today's total brush_count + 1.
 if brush_count + 1 >= 2 and c.last_perfect_date is distinct from d then
   became_perfect := true;
   if c.last_perfect_date = d - 1 then new_perfect := c.perfect_streak + 1;
   else new_perfect := 1;
   end if;
 else
   new_perfect := c.perfect_streak;
 end if;

 insert into public.brushing_sessions(child_id,parent_id,duration_seconds,xp_earned,gloss_earned)
 values(c.id,c.parent_id,least(p_duration,600),xp_gain,gloss_gain);

 update public.child_profiles set
   xp=xp+xp_gain,
   gloss=least(100,gloss+gloss_gain),
   egg_energy=least(100,egg_energy+egg_gain),
   streak=new_streak,
   perfect_streak=new_perfect,
   last_brush_date=d,
   last_perfect_date=case when became_perfect then d else last_perfect_date end
 where id=c.id returning * into c;

 return jsonb_build_object(
   'profile',to_jsonb(c),
   'brushes_today',brush_count+1,
   'perfect_day',(brush_count+1)>=2,
   'became_perfect',became_perfect
 );
end $$;

revoke all on function public.complete_brushing_v091(uuid,integer) from public;
grant execute on function public.complete_brushing_v091(uuid,integer) to authenticated;
