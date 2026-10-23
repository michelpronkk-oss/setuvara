-- Production only: schedule the daily IndexNow ping (run once; re-running updates the same job).
-- Calls the Vercel route with the Vault secret created by migration 20261113090000. The route sends
-- the sitemap URLs changed in the last day (member pages edited, all marketing pages after a deploy).
select cron.schedule(
  'setuvara-indexnow',
  '23 6 * * *',
  $job$
    select net.http_get(
      url := 'https://setuvara.com/api/indexnow',
      headers := jsonb_build_object('authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'setuvara_indexnow')),
      timeout_milliseconds := 60000
    );
  $job$
);
