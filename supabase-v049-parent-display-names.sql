-- Anzeigenamen fuer Elternkonten in der Familiengruppe
alter table public.family_members
  add column if not exists display_name text
  check (display_name is null or char_length(trim(display_name)) between 1 and 30);

create or replace function private.family_status()
returns jsonb language plpgsql stable security definer set search_path='public','private','auth' as $$
declare fid uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from public.family_members where user_id=auth.uid() limit 1;
  if fid is null then return null; end if;
  select jsonb_build_object(
    'id',f.id,
    'name',f.name,
    'emoji',coalesce(f.emoji,'👨‍👩‍👧‍👦'),
    'invite_code',f.invite_code,
    'role',(select m.role from public.family_members m where m.family_id=f.id and m.user_id=auth.uid()),
    'adults',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',m.user_id,
        'role',m.role,
        'display_name',m.display_name,
        'email',u.email
      ) order by m.joined_at)
      from public.family_members m
      join auth.users u on u.id=m.user_id
      where m.family_id=f.id
    ),'[]'::jsonb)
  ) into result from public.families f where f.id=fid;
  return result;
end $$;

revoke all on function private.family_status() from public,anon;
grant execute on function private.family_status() to authenticated;
