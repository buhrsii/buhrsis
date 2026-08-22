
alter table public.buhrsis
  add column if not exists care_score integer not null default 50 check (care_score between 0 and 100),
  add column if not exists last_care_date date,
  add column if not exists stage integer not null default 1 check (stage between 1 and 3);

create or replace function public.update_buhrsi_values(p_child uuid)
returns setof public.buhrsis
language plpgsql security definer set search_path=public
as $$
declare days_missed integer; care_delta integer;
begin
 if not exists(select 1 from public.child_profiles where id=p_child and parent_id=auth.uid()) then
   raise exception 'child not found';
 end if;

 update public.buhrsis b set
   care_score = greatest(0,least(100,
     b.care_score +
     case
       when exists(select 1 from public.brushing_sessions s where s.child_id=p_child and s.completed_at::date=current_date) then 2
       else -3
     end)),
   last_care_date=current_date
 where b.child_id=p_child and b.parent_id=auth.uid()
   and (b.last_care_date is null or b.last_care_date < current_date);

 update public.buhrsis b set
   current_value=greatest(1,round(b.base_value * (0.70 + b.care_score::numeric/200))::int),
   stage=case when b.xp>=500 then 3 when b.xp>=150 then 2 else 1 end
 where b.child_id=p_child and b.parent_id=auth.uid();

 return query select * from public.buhrsis where child_id=p_child and parent_id=auth.uid() order by born_at desc;
end $$;

create or replace function public.feed_buhrsi_brush_xp(p_child uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.child_profiles where id=p_child and parent_id=auth.uid()) then raise exception 'child not found'; end if;
 update public.buhrsis set xp=xp+10,bond=least(100,bond+1),gloss=least(100,gloss+1)
 where child_id=p_child and parent_id=auth.uid();
end $$;

revoke all on function public.update_buhrsi_values(uuid) from public;
grant execute on function public.update_buhrsi_values(uuid) to authenticated;
revoke all on function public.feed_buhrsi_brush_xp(uuid) from public;
grant execute on function public.feed_buhrsi_brush_xp(uuid) to authenticated;
