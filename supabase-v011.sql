
create table if not exists public.buhrsis (
 id uuid primary key default gen_random_uuid(),
 child_id uuid not null references public.child_profiles(id) on delete cascade,
 parent_id uuid not null references auth.users(id) on delete cascade,
 species text not null default 'Mori',
 variant text not null default 'stone',
 rarity text not null check (rarity in ('COMMON','RARE','EPIC','LEGENDARY')),
 base_value integer not null check (base_value >= 0),
 current_value integer not null check (current_value >= 0),
 level integer not null default 1 check (level >= 1),
 xp integer not null default 0 check (xp >= 0),
 bond integer not null default 50 check (bond between 0 and 100),
 gloss integer not null default 50 check (gloss between 0 and 100),
 born_at timestamptz not null default now()
);
alter table public.buhrsis enable row level security;

drop policy if exists "parents_select_own_buhrsis" on public.buhrsis;
create policy "parents_select_own_buhrsis" on public.buhrsis for select using(auth.uid()=parent_id);
drop policy if exists "parents_insert_own_buhrsis" on public.buhrsis;
create policy "parents_insert_own_buhrsis" on public.buhrsis for insert with check(auth.uid()=parent_id);
drop policy if exists "parents_update_own_buhrsis" on public.buhrsis;
create policy "parents_update_own_buhrsis" on public.buhrsis for update using(auth.uid()=parent_id) with check(auth.uid()=parent_id);

create or replace function public.hatch_ready_egg(p_child uuid)
returns public.buhrsis
language plpgsql security definer set search_path=public
as $$
declare c public.child_profiles; roll numeric; rar text; val integer; variant text; b public.buhrsis;
begin
 select * into c from public.child_profiles where id=p_child and parent_id=auth.uid() for update;
 if not found then raise exception 'child not found'; end if;
 if c.egg_energy < 100 then raise exception 'egg not ready'; end if;

 roll:=random();
 if roll < .02 then rar:='LEGENDARY'; val:=1800+floor(random()*500); variant:='aurora';
 elsif roll < .10 then rar:='EPIC'; val:=950+floor(random()*300); variant:='ember';
 elsif roll < .32 then rar:='RARE'; val:=520+floor(random()*200); variant:='moss';
 else rar:='COMMON'; val:=240+floor(random()*140); variant:='stone'; end if;

 insert into public.buhrsis(child_id,parent_id,species,variant,rarity,base_value,current_value)
 values(c.id,c.parent_id,'Mori',variant,rar,val,val) returning * into b;
 update public.child_profiles set egg_energy=0 where id=c.id;
 return b;
end $$;

revoke all on function public.hatch_ready_egg(uuid) from public;
grant execute on function public.hatch_ready_egg(uuid) to authenticated;
