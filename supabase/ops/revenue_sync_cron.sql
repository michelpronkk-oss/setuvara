-- Production only: schedule the Verified Revenue sync (run once; re-running updates the same job).
-- Hourly, so a backlog drains in batches; each connection is synced at most once every 20 hours.
select cron.schedule(
  'setuvara-revenue-sync',
  '41 * * * *',
  $job$
    select net.http_get(
      url := 'https://setuvara.com/api/revenue/sync',
      headers := jsonb_build_object('authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'setuvara_revenue_sync')),
      timeout_milliseconds := 60000
    );
  $job$
);
