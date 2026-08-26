-- Buhrsi's v0.28 – Push-Erinnerungen
-- Die Migration ist bereits im verbundenen Supabase-Projekt angewendet.
-- VAPID-Private-Key und Cron-Token gehören in Supabase Vault und NICHT in dieses Repository.

create table if not exists public.buhrsi_reminder_settings (
  child_id uuid primary key references public.child_profiles(id) on delete cascade,
  morning_enabled boolean not null default true,
  morning_time time not null default '07:00',
  evening_enabled boolean not null default true,
  evening_time time not null default '19:00',
  timezone text not null default 'Europe/Berlin',
  updated_at timestamptz not null default now()
);

create table if not exists public.buhrsi_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists buhrsi_push_subscriptions_child_idx on public.buhrsi_push_subscriptions(child_id) where active=true;

create table if not exists public.buhrsi_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  reminder_date date not null,
  period text not null check(period in ('morning','evening')),
  delivered_at timestamptz not null default now(),
  unique(child_id,reminder_date,period)
);

alter table public.buhrsi_reminder_settings enable row level security;
alter table public.buhrsi_push_subscriptions enable row level security;
alter table public.buhrsi_reminder_deliveries enable row level security;
revoke all on public.buhrsi_reminder_settings from anon,authenticated;
revoke all on public.buhrsi_push_subscriptions from anon,authenticated;
revoke all on public.buhrsi_reminder_deliveries from anon,authenticated;

create or replace function public.buhrsi_reminders_get(p_child uuid,p_pin text default null)
returns table(morning_enabled boolean,morning_time time,evening_enabled boolean,evening_time time,timezone text)
language plpgsql security definer set search_path=public,extensions as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  insert into public.buhrsi_reminder_settings(child_id) values(p_child) on conflict(child_id) do nothing;
  return query select r.morning_enabled,r.morning_time,r.evening_enabled,r.evening_time,r.timezone from public.buhrsi_reminder_settings r where r.child_id=p_child;
end $$;

create or replace function public.buhrsi_reminders_save(p_child uuid,p_morning_enabled boolean,p_morning_time time,p_evening_enabled boolean,p_evening_time time,p_timezone text,p_pin text default null)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  insert into public.buhrsi_reminder_settings(child_id,morning_enabled,morning_time,evening_enabled,evening_time,timezone,updated_at)
  values(p_child,p_morning_enabled,p_morning_time,p_evening_enabled,p_evening_time,coalesce(nullif(trim(p_timezone),''),'Europe/Berlin'),now())
  on conflict(child_id) do update set morning_enabled=excluded.morning_enabled,morning_time=excluded.morning_time,evening_enabled=excluded.evening_enabled,evening_time=excluded.evening_time,timezone=excluded.timezone,updated_at=now();
  return true;
end $$;

create or replace function public.buhrsi_push_upsert(p_child uuid,p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default null,p_pin text default null)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  insert into public.buhrsi_push_subscriptions(child_id,endpoint,p256dh,auth,user_agent,active,updated_at)
  values(p_child,p_endpoint,p_p256dh,p_auth,p_user_agent,true,now())
  on conflict(endpoint) do update set child_id=excluded.child_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,active=true,updated_at=now();
  return true;
end $$;

create or replace function public.buhrsi_push_remove(p_child uuid,p_endpoint text,p_pin text default null)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not public.buhrsi_social_authorized(p_child,p_pin) then raise exception 'not authorized'; end if;
  update public.buhrsi_push_subscriptions set active=false,updated_at=now() where child_id=p_child and endpoint=p_endpoint;
  return true;
end $$;

revoke all on function public.buhrsi_reminders_get(uuid,text) from public;
revoke all on function public.buhrsi_reminders_save(uuid,boolean,time,boolean,time,text,text) from public;
revoke all on function public.buhrsi_push_upsert(uuid,text,text,text,text,text) from public;
revoke all on function public.buhrsi_push_remove(uuid,text,text) from public;
grant execute on function public.buhrsi_reminders_get(uuid,text) to anon,authenticated;
grant execute on function public.buhrsi_reminders_save(uuid,boolean,time,boolean,time,text,text) to anon,authenticated;
grant execute on function public.buhrsi_push_upsert(uuid,text,text,text,text,text) to anon,authenticated;
grant execute on function public.buhrsi_push_remove(uuid,text,text) to anon,authenticated;

create or replace function public.buhrsi_due_push_reminders(p_now timestamptz default now())
returns table(subscription_id uuid,endpoint text,p256dh text,auth text,child_id uuid,child_name text,period text,reminder_date date)
language sql security definer set search_path=public as $$
with settings as (
  select r.*,c.name,(p_now at time zone r.timezone)::date local_date,(p_now at time zone r.timezone)::time local_time
  from public.buhrsi_reminder_settings r join public.child_profiles c on c.id=r.child_id and c.is_active=true
),due as (
  select s.*,'morning'::text due_period from settings s where s.morning_enabled and s.local_time>=s.morning_time and s.local_time<s.morning_time+interval '10 minutes'
  union all
  select s.*,'evening'::text from settings s where s.evening_enabled and s.local_time>=s.evening_time and s.local_time<s.evening_time+interval '10 minutes'
),eligible as (
  select d.* from due d
  where not exists(select 1 from public.buhrsi_reminder_deliveries x where x.child_id=d.child_id and x.reminder_date=d.local_date and x.period=d.due_period)
  and not exists(select 1 from public.brushing_sessions b where b.child_id=d.child_id and (b.completed_at at time zone d.timezone)::date=d.local_date and ((d.due_period='morning' and (b.completed_at at time zone d.timezone)::time<time '12:00') or (d.due_period='evening' and (b.completed_at at time zone d.timezone)::time>=time '12:00')))
)
select ps.id,ps.endpoint,ps.p256dh,ps.auth,e.child_id,e.name,e.due_period,e.local_date
from eligible e join public.buhrsi_push_subscriptions ps on ps.child_id=e.child_id and ps.active=true;
$$;
revoke all on function public.buhrsi_due_push_reminders(timestamptz) from public;
grant execute on function public.buhrsi_due_push_reminders(timestamptz) to service_role;

create or replace function public.buhrsi_mark_reminder_delivered(p_child uuid,p_date date,p_period text)
returns void language sql security definer set search_path=public as $$
insert into public.buhrsi_reminder_deliveries(child_id,reminder_date,period) values(p_child,p_date,p_period) on conflict(child_id,reminder_date,period) do nothing;
$$;
revoke all on function public.buhrsi_mark_reminder_delivered(uuid,date,text) from public;
grant execute on function public.buhrsi_mark_reminder_delivered(uuid,date,text) to service_role;

create or replace function public.buhrsi_push_secret(p_name text)
returns text language plpgsql security definer set search_path=public,vault as $$
declare v text;
begin
  if auth.role()<>'service_role' then raise exception 'not authorized'; end if;
  select decrypted_secret into v from vault.decrypted_secrets where name=p_name order by created_at desc limit 1;
  return v;
end $$;
revoke all on function public.buhrsi_push_secret(text) from public;
grant execute on function public.buhrsi_push_secret(text) to service_role;

-- Der aktive Cron-Job läuft alle 5 Minuten und ruft die Edge Function send-brush-reminders auf.
-- Token und private VAPID-Schlüssel werden ausschließlich aus Supabase Vault gelesen.
