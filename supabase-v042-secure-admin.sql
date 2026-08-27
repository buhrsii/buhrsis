-- Buhrsi v0.42: secure single-admin access
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"buhrsi_admin":true}'::jsonb
where id='f92b8ab2-3b66-493b-98f0-3b22d7bb54eb'
  and lower(email)=lower('florian0401@gmail.com');

drop policy if exists admin_select_all_children on public.child_profiles;
create policy admin_select_all_children on public.child_profiles
for select to authenticated
using (coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false));

drop policy if exists admin_update_all_children on public.child_profiles;
create policy admin_update_all_children on public.child_profiles
for update to authenticated
using (coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false))
with check (coalesce((auth.jwt()->'app_metadata'->>'buhrsi_admin')::boolean,false));
