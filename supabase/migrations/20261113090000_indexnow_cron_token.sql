-- IndexNow: the bearer token pg_cron sends to /api/indexnow, kept in Vault and checked by the
-- route through indexnow_cron_token_valid (service role only). Same pattern as the revenue sync.
create or replace function public.indexnow_cron_token_valid(p_token text)
returns boolean language sql stable security definer set search_path='' as $function$
  select coalesce(pg_catalog.length(p_token) >= 32 and exists(
    select 1 from vault.decrypted_secrets s where s.name = 'setuvara_indexnow' and s.decrypted_secret = p_token), false)
$function$;

revoke all on function public.indexnow_cron_token_valid(text) from public, anon, authenticated;
grant execute on function public.indexnow_cron_token_valid(text) to service_role;

do $vault$
begin
  if not exists(select 1 from vault.secrets where name = 'setuvara_indexnow') then
    perform vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'), 'setuvara_indexnow',
      'Bearer token pg_cron sends to /api/indexnow');
  end if;
end
$vault$;
