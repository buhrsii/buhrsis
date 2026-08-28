create index if not exists brushing_sessions_child_completed_idx
  on public.brushing_sessions(child_id,completed_at);

create or replace function public.buhrsi_brush_calendar(
  p_child uuid,
  p_token text default null,
  p_month date default current_date
)
returns table(brush_date date, brush_count integer)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  month_start date := date_trunc('month', coalesce(p_month,current_date))::date;
begin
  if not public.buhrsi_social_authorized(p_child,p_token) then
    raise exception 'not authorized';
  end if;

  return query
  select s.completed_at::date, count(*)::integer
  from public.brushing_sessions s
  where s.child_id=p_child
    and s.completed_at >= month_start::timestamptz
    and s.completed_at < (month_start + interval '1 month')::timestamptz
  group by s.completed_at::date
  order by s.completed_at::date;
end
$$;

revoke all on function public.buhrsi_brush_calendar(uuid,text,date) from public;
grant execute on function public.buhrsi_brush_calendar(uuid,text,date) to anon,authenticated;
