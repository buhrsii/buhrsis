-- v0.46: Familienname und Familien-Emoji durch angemeldete Eltern bearbeiten.
alter table public.families
  add column if not exists emoji text not null default '👨‍👩‍👧‍👦';

alter table public.families
  drop constraint if exists families_emoji_allowed;

alter table public.families
  add constraint families_emoji_allowed check (
    emoji in ('👨‍👩‍👧‍👦','🏡','❤️','🌟','🐻','🦊','🐼','🦁','🌈','🚀')
  );

create or replace function private.family_status()
returns jsonb language plpgsql stable security definer set search_path='public','private','auth' as $$
declare fid uuid; result jsonb;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from public.family_members where user_id=auth.uid() limit 1;
  if fid is null then return null; end if;
  select jsonb_build_object(
    'id',f.id,'name',f.name,'emoji',f.emoji,'invite_code',f.invite_code,
    'role',(select m.role from public.family_members m where m.family_id=f.id and m.user_id=auth.uid()),
    'adults',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'email',u.email) order by m.joined_at) from public.family_members m join auth.users u on u.id=m.user_id where m.family_id=f.id),'[]'::jsonb)
  ) into result from public.families f where f.id=fid;
  return result;
end $$;

create or replace function private.update_family(p_name text, p_emoji text)
returns jsonb language plpgsql security definer set search_path='public','private' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select family_id into fid from public.family_members where user_id=auth.uid() limit 1;
  if fid is null then raise exception 'Keine Familie gefunden'; end if;
  if char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 60 then
    raise exception 'Der Familienname muss 1 bis 60 Zeichen lang sein';
  end if;
  if p_emoji not in ('👨‍👩‍👧‍👦','🏡','❤️','🌟','🐻','🦊','🐼','🦁','🌈','🚀') then
    raise exception 'Bitte ein gültiges Familien-Emoji auswählen';
  end if;
  update public.families set name=trim(p_name),emoji=p_emoji where id=fid;
  return private.family_status();
end $$;

revoke all on function private.update_family(text,text) from public,anon;
grant execute on function private.update_family(text,text) to authenticated;

create or replace function public.buhrsi_family_update(p_name text,p_emoji text)
returns jsonb language sql security invoker set search_path='public','private'
as $$select private.update_family(p_name,p_emoji)$$;

revoke all on function public.buhrsi_family_update(text,text) from public,anon;
grant execute on function public.buhrsi_family_update(text,text) to authenticated;
