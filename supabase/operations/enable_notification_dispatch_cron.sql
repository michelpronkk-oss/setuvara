-- Run only against the verified hosted Setuvara project after deploying
-- dispatch-notifications. This is intentionally outside migrations so a local
-- Supabase reset cannot schedule requests to the hosted project.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $setup$
declare
  v_secret text;
begin
  if not exists (
    select 1 from private.notification_dispatch_secret
    where name = 'setuvara_notification_dispatch'
  ) then
    v_secret := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
    insert into private.notification_dispatch_secret(name, secret_hash)
    values (
      'setuvara_notification_dispatch',
      extensions.digest(pg_catalog.convert_to(v_secret, 'UTF8'), 'sha256')
    );
    perform vault.create_secret(
      v_secret,
      'setuvara_notification_dispatch',
      'Setuvara notification scheduler bearer'
    );
  elsif not exists (
    select 1 from vault.secrets where name = 'setuvara_notification_dispatch'
  ) then
    raise exception 'Setuvara notification scheduler Vault secret is missing';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'setuvara-notification-dispatch'
  ) then
    perform cron.schedule(
      'setuvara-notification-dispatch',
      '* * * * *',
      $job$
        select net.http_post(
          url := 'https://wizqtlgnuiicvpycvhhc.supabase.co/functions/v1/dispatch-notifications',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-setuvara-cron-secret', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'setuvara_notification_dispatch'
            )
          ),
          body := '{}'::jsonb
        ) as request_id;
      $job$
    );
  end if;
end;
$setup$;
