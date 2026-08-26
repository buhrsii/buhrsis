-- Buhrsi's v0.30 – Sammlung und Schlüpfen auch in sicherer Kinder-Geräte-Session

create or replace function public.buhrsi_child_collection(p_child uuid, p_token text)
returns setof public.buhrsis
language sql security definer set search_path=public,extensions
as $$
  select b.*
  from public.buhrsis b
  where b.child_id=p_child
    and public.buhrsi_child_device_authorized(p_child,p_token)
  order by b.born_at desc;
$$;
revoke all on function public.buhrsi_child_collection(uuid,text) from public;
grant execute on function public.buhrsi_child_collection(uuid,text) to anon,authenticated;

create or replace function public.buhrsi_child_hatch_ready_egg(p_child uuid, p_token text)
returns public.buhrsis
language plpgsql security definer set search_path=public,extensions
as $$
declare
  c public.child_profiles;
  roll numeric;
  pick numeric;
  rar text;
  val integer;
  v_variant text;
  v_species text;
  b public.buhrsis;
begin
  if not public.buhrsi_child_device_authorized(p_child,p_token) then
    raise exception 'invalid child session';
  end if;

  select * into c from public.child_profiles where id=p_child and is_active=true for update;
  if not found then raise exception 'child not found'; end if;
  if c.egg_energy < 100 then raise exception 'egg not ready'; end if;

  roll:=random();
  if roll<0.02 then rar:='LEGENDARY'; val:=1800+floor(random()*500);
  elsif roll<0.10 then rar:='EPIC'; val:=950+floor(random()*300);
  elsif roll<0.32 then rar:='RARE'; val:=520+floor(random()*200);
  else rar:='COMMON'; val:=240+floor(random()*140); end if;

  pick:=random();
  if rar='LEGENDARY' then
    if pick<1.0/3 then v_species:='Aurorix';v_variant:='aurorix';
    elsif pick<2.0/3 then v_species:='Mondmäuschen';v_variant:='mondmaeuschen';
    else v_species:='Sonnenfürst';v_variant:='sonnenfuerst';end if;
  elsif rar='EPIC' then
    if pick<.25 then v_species:='Lavaknirp';v_variant:='lavaknirp';
    elsif pick<.50 then v_species:='Glitzerglück';v_variant:='glitzerglueck';
    elsif pick<.75 then v_species:='Amethysta';v_variant:='amethysta';
    else v_species:='Smaragdus';v_variant:='smaragdus';end if;
  elsif rar='RARE' then
    if pick<.125 then v_species:='Rosalie';v_variant:='rosalie';
    elsif pick<.250 then v_species:='Brillberto';v_variant:='brillberto';
    elsif pick<.375 then v_species:='Zauberlin';v_variant:='zauberlin';
    elsif pick<.500 then v_species:='Herzilein';v_variant:='herzilein';
    elsif pick<.625 then v_species:='Pinkadora';v_variant:='pinkadora';
    elsif pick<.750 then v_species:='Detekto';v_variant:='detekto';
    elsif pick<.875 then v_species:='Königchen';v_variant:='koenigchen';
    else v_species:='Käpt''n Keks';v_variant:='kaeptn_keks';end if;
  else
    if pick<1.0/9 then v_species:='Moxu';v_variant:='moxu';
    elsif pick<2.0/9 then v_species:='Pünktchen';v_variant:='puenktchen';
    elsif pick<3.0/9 then v_species:='Sonnenschein';v_variant:='sonnenschein';
    elsif pick<4.0/9 then v_species:='Flämmchen';v_variant:='flaemmchen';
    elsif pick<5.0/9 then v_species:='Bluupy';v_variant:='bluupy';
    elsif pick<6.0/9 then v_species:='Zitro';v_variant:='zitro';
    elsif pick<7.0/9 then v_species:='Wellenbob';v_variant:='wellenbob';
    elsif pick<8.0/9 then v_species:='Schlumpfi';v_variant:='schlumpfi';
    else v_species:='Regenknirps';v_variant:='regenknirps';end if;
  end if;

  insert into public.buhrsis(child_id,parent_id,species,variant,rarity,base_value,current_value)
  values(c.id,c.parent_id,v_species,v_variant,rar,val,val) returning * into b;
  update public.child_profiles set egg_energy=0 where id=c.id;
  return b;
end $$;
revoke all on function public.buhrsi_child_hatch_ready_egg(uuid,text) from public;
grant execute on function public.buhrsi_child_hatch_ready_egg(uuid,text) to anon,authenticated;
