create table if not exists public.child_profiles (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 30),
 avatar text not null default 'default',
 xp integer not null default 0 check (xp >= 0),
 gloss integer not null default 50 check (gloss between 0 and 100),
 streak integer not null default 0 check (streak >= 0),
 egg_energy integer not null default 0 check (egg_energy >= 0),
 created_at timestamptz not null default now()
);
alter table public.child_profiles enable row level security;
drop policy if exists "own_select" on public.child_profiles;
create policy "own_select" on public.child_profiles for select using (auth.uid()=parent_id);
drop policy if exists "own_insert" on public.child_profiles;
create policy "own_insert" on public.child_profiles for insert with check (auth.uid()=parent_id);
drop policy if exists "own_update" on public.child_profiles;
create policy "own_update" on public.child_profiles for update using (auth.uid()=parent_id) with check (auth.uid()=parent_id);
drop policy if exists "own_delete" on public.child_profiles;
create policy "own_delete" on public.child_profiles for delete using (auth.uid()=parent_id);
