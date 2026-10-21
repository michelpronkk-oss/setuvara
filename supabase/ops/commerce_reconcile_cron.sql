-- Production only: schedule the hourly Commerce reconciliation (run once; re-running updates the same job).
-- pg_cron is the single scheduler for this job. It calls the Vercel route with the Vault secret
-- created by migration 20261026090000; the route checks it through commerce_cron_token_valid,
-- takes the job lease and logs to commerce_job_runs. pg_net keeps the HTTP response for ~6 hours
-- (net._http_response); cron.job_run_details keeps the scheduler's own history.
select cron.schedule(
  'setuvara-commerce-reconcile',
  '17 * * * *',
  $job$
    select net.http_get(
      url := 'https://setuvara.com/api/commerce/reconcile',
      headers := jsonb_build_object('authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'setuvara_commerce_reconcile')),
      timeout_milliseconds := 60000
    );
  $job$
);
