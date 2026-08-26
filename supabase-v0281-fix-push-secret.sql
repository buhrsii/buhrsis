-- v0.28.1 – Vault-Zugriff für den service_role-Aufruf der Edge Function
create or replace function public.buhrsi_push_secret(p_name text)
returns text
language sql
security definer
set search_path=public,vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name=p_name
  order by created_at desc
  limit 1;
$$;
revoke all on function public.buhrsi_push_secret(text) from public;
grant execute on function public.buhrsi_push_secret(text) to service_role;
