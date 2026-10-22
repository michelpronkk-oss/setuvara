-- Weekly digest: every Monday, members whose page saw activity last week (Monday to Sunday,
-- UTC) get one email with their numbers against the week before, their busiest Mode, their
-- most tapped link and the people they met. On by default, one tap to turn off.
set lock_timeout = '5s';

alter table public.notification_preferences add column weekly_digest boolean not null default true;
grant select (weekly_digest), insert (weekly_digest), update (weekly_digest) on public.notification_preferences to authenticated;

alter table private.email_deliveries drop constraint email_deliveries_template_key_check;
alter table private.email_deliveries add constraint email_deliveries_template_key_check
  check (template_key = any (array['welcome', 'new_connection', 'connection_recap', 'guest_claimed', 'passport_milestone', 'passport_stamp', 'weekly_digest']));

alter table private.email_unsubscribe_tokens drop constraint email_unsubscribe_tokens_category_check;
alter table private.email_unsubscribe_tokens add constraint email_unsubscribe_tokens_category_check
  check (category = any (array['connection_emails', 'connection_recaps', 'passport_milestones', 'passport_stamps', 'lifecycle_emails', 'product_updates', 'weekly_digest']));

create or replace function private.enqueue_notification(p_user_id uuid, p_category text, p_template_key text, p_delivery_key text, p_source_id uuid default null, p_scheduled_at timestamptz default pg_catalog.statement_timestamp())
returns uuid language plpgsql security definer set search_path = '' as $function$
declare v_delivery_id uuid;
begin
  if p_user_id is null then return null; end if;
  if p_category not in ('security','connection','reward','lifecycle','product') then return null; end if;
  if p_template_key not in ('welcome','new_connection','connection_recap','guest_claimed','passport_milestone','passport_stamp','weekly_digest') then return null; end if;
  if p_category = 'connection' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.connection_emails
  ) then return null; end if;
  if p_template_key = 'connection_recap' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.connection_recaps
  ) then return null; end if;
  if p_template_key = 'passport_milestone' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.passport_milestones
  ) then return null; end if;
  if p_template_key = 'passport_stamp' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.passport_stamps
  ) then return null; end if;
  if p_template_key = 'weekly_digest' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.weekly_digest
  ) then return null; end if;
  if p_category = 'lifecycle' and exists (
    select 1 from public.notification_preferences p where p.user_id = p_user_id and not p.lifecycle_emails
  ) then return null; end if;

  insert into private.email_deliveries(delivery_key, recipient_user_id, category, template_key, scheduled_at)
  values (p_delivery_key, p_user_id, p_category, p_template_key, p_scheduled_at)
  on conflict(delivery_key) do update
    set scheduled_at = least(private.email_deliveries.scheduled_at, excluded.scheduled_at)
    where private.email_deliveries.status = 'pending'
  returning id into v_delivery_id;
  if v_delivery_id is null then
    select id into v_delivery_id from private.email_deliveries where delivery_key = p_delivery_key;
  end if;
  insert into private.notification_events(delivery_id, event_key, source_id)
  values(v_delivery_id, p_delivery_key || ':' || coalesce(p_source_id::text, 'none'), p_source_id)
  on conflict(event_key) do nothing;
  return v_delivery_id;
end;
$function$;

create or replace function public.record_email_unsubscribe_token(p_user_id uuid, p_category text, p_hash_hex text)
returns boolean language plpgsql security definer set search_path = '' as $function$
begin
  if p_category not in ('connection_emails','connection_recaps','passport_milestones','passport_stamps','lifecycle_emails','product_updates','weekly_digest')
     or p_hash_hex !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into private.email_unsubscribe_tokens(token_hash,user_id,category)
  values(pg_catalog.decode(p_hash_hex,'hex'),p_user_id,p_category) on conflict(token_hash) do nothing;
  return true;
end;
$function$;

create or replace function public.apply_email_unsubscribe(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_token private.email_unsubscribe_tokens%rowtype;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then return false; end if;
  select * into v_token from private.email_unsubscribe_tokens
    where token_hash = extensions.digest(pg_catalog.convert_to(p_token,'UTF8'),'sha256')
      and used_at is null and expires_at > pg_catalog.statement_timestamp()
    for update;
  if not found then return false; end if;
  insert into public.notification_preferences(user_id)
  values(v_token.user_id) on conflict(user_id) do nothing;
  update public.notification_preferences set
    connection_emails = case when v_token.category='connection_emails' then false else connection_emails end,
    connection_recaps = case when v_token.category='connection_recaps' then false else connection_recaps end,
    passport_milestones = case when v_token.category='passport_milestones' then false else passport_milestones end,
    passport_stamps = case when v_token.category='passport_stamps' then false else passport_stamps end,
    lifecycle_emails = case when v_token.category='lifecycle_emails' then false else lifecycle_emails end,
    product_updates = case when v_token.category='product_updates' then false else product_updates end,
    weekly_digest = case when v_token.category='weekly_digest' then false else weekly_digest end,
    updated_at = pg_catalog.statement_timestamp()
  where user_id = v_token.user_id;
  update private.email_unsubscribe_tokens set used_at = pg_catalog.statement_timestamp() where token_hash = v_token.token_hash;
  return true;
end;
$function$;

-- Same context as before, plus the weekly digest preference.
create or replace function public.get_email_delivery_context(p_delivery_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'delivery', jsonb_build_object('id', d.id, 'key', d.delivery_key, 'recipientUserId', d.recipient_user_id, 'category', d.category, 'template', d.template_key),
    'recipient', jsonb_build_object('email', u.email, 'confirmed', u.email_confirmed_at is not null),
    'profile', (select jsonb_build_object('username', p.username, 'displayName', p.display_name) from public.profiles p where p.id = d.recipient_user_id),
    'preferences', (select jsonb_build_object(
      'connectionEmails', coalesce(p.connection_emails,true), 'connectionRecaps', coalesce(p.connection_recaps,true),
      'passportMilestones', coalesce(p.passport_milestones,true), 'passportStamps', coalesce(p.passport_stamps,true),
      'lifecycleEmails', coalesce(p.lifecycle_emails,true), 'weeklyDigest', coalesce(p.weekly_digest,true)
    ) from (select 1) seed left join public.notification_preferences p on p.user_id=d.recipient_user_id),
    'events', coalesce((select jsonb_agg(jsonb_build_object('sourceId', e.source_id, 'eventKey', e.event_key, 'createdAt', e.created_at) order by e.created_at)
      from private.notification_events e where e.delivery_id = d.id), '[]'::jsonb),
    'encounters', coalesce((select jsonb_agg(jsonb_build_object(
      'sharedByUserId', enc.shared_by_user_id, 'createdByUserId', enc.created_by_user_id,
      'sharedDisplayName', enc.shared_display_name, 'sharedRole', enc.shared_role,
      'sharedCompany', enc.shared_company, 'eventName', enc.event_name,
      'city', enc.city, 'dateLabel', enc.date_label, 'createdAt', enc.created_at,
      'otherName', case when enc.shared_by_user_id = d.recipient_user_id then
        coalesce(creator.display_name, conn.guest_display_name, 'Someone') else
        coalesce(shared.display_name, 'Someone') end,
      'otherRole', case when enc.shared_by_user_id = d.recipient_user_id then enc.share_back_role else enc.shared_role end,
      'otherCompany', case when enc.shared_by_user_id = d.recipient_user_id then enc.share_back_company else enc.shared_company end
    ) order by enc.created_at desc)
      from private.notification_events ev
      join public.connection_encounters enc on enc.id = ev.source_id
      left join public.connections conn on conn.id = enc.connection_id
      left join public.profiles creator on creator.id = enc.created_by_user_id
      left join public.profiles shared on shared.id = enc.shared_by_user_id
      where ev.delivery_id = d.id), '[]'::jsonb),
    'claimedProfile', (select jsonb_build_object('displayName', p.display_name, 'username', p.username)
      from private.notification_events ev join public.guest_identities gi on gi.id = ev.source_id
      join public.profiles p on p.id = gi.claimed_user_id where ev.delivery_id = d.id limit 1),
    'milestone', (select jsonb_build_object('threshold', m.threshold, 'unlockedAt', m.unlocked_at)
      from private.email_deliveries md join private.notification_events ev on ev.delivery_id = md.id
      join public.passport_milestones m on m.user_id = md.recipient_user_id and md.template_key = 'passport_milestone'
        and md.delivery_key = 'passport-milestone:' || m.user_id::text || ':' || m.threshold::text
      where md.id = d.id limit 1),
    'stamps', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'subtitle', s.subtitle, 'type', s.stamp_type, 'earnedAt', s.earned_at) order by s.earned_at desc)
      from private.notification_events ev join public.passport_stamps s on s.id = ev.source_id where ev.delivery_id = d.id), '[]'::jsonb)
  ) into v_result
  from private.email_deliveries d join auth.users u on u.id = d.recipient_user_id
  where d.id = p_delivery_id;
  return v_result;
end;
$function$;

-- One member's week, the numbers the digest shows. The week is the Monday in the delivery key.
create function public.get_weekly_digest(p_delivery_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare
  v_user uuid;
  v_week date;
  v_now jsonb;
  v_before jsonb;
  v_top_mode text;
  v_best_day date;
  v_top_link jsonb;
  v_people jsonb;
begin
  select d.recipient_user_id, pg_catalog.substring(d.delivery_key, '(\d{4}-\d{2}-\d{2})$')::date
    into v_user, v_week
  from private.email_deliveries d
  where d.id = p_delivery_id and d.template_key = 'weekly_digest';
  if v_user is null or v_week is null then return null; end if;

  select pg_catalog.jsonb_build_object(
      'views', pg_catalog.count(*) filter (where e.event_name = 'profile_viewed' and e.occurred_at >= v_week::timestamp at time zone 'UTC'),
      'scans', pg_catalog.count(*) filter (where ((e.event_name = 'profile_viewed' and e.source = 'qr') or e.event_name in ('quick_qr_scanned', 'tap_scanned')) and e.occurred_at >= v_week::timestamp at time zone 'UTC'),
      'connections', pg_catalog.count(*) filter (where e.event_name = 'connection_created' and e.occurred_at >= v_week::timestamp at time zone 'UTC')),
    pg_catalog.jsonb_build_object(
      'views', pg_catalog.count(*) filter (where e.event_name = 'profile_viewed' and e.occurred_at < v_week::timestamp at time zone 'UTC'),
      'scans', pg_catalog.count(*) filter (where ((e.event_name = 'profile_viewed' and e.source = 'qr') or e.event_name in ('quick_qr_scanned', 'tap_scanned')) and e.occurred_at < v_week::timestamp at time zone 'UTC'),
      'connections', pg_catalog.count(*) filter (where e.event_name = 'connection_created' and e.occurred_at < v_week::timestamp at time zone 'UTC'))
    into v_now, v_before
  from private.product_analytics_events e
  where e.owner_profile_id = v_user
    and e.occurred_at >= (v_week - 7)::timestamp at time zone 'UTC'
    and e.occurred_at < (v_week + 7)::timestamp at time zone 'UTC';

  select e.mode_slug into v_top_mode
  from private.product_analytics_events e
  where e.owner_profile_id = v_user and e.event_name = 'profile_viewed' and e.mode_slug in ('personal', 'event', 'business', 'creator')
    and e.occurred_at >= v_week::timestamp at time zone 'UTC' and e.occurred_at < (v_week + 7)::timestamp at time zone 'UTC'
  group by e.mode_slug order by pg_catalog.count(*) desc, e.mode_slug limit 1;

  select (e.occurred_at at time zone 'UTC')::date into v_best_day
  from private.product_analytics_events e
  where e.owner_profile_id = v_user and e.event_name = 'profile_viewed'
    and e.occurred_at >= v_week::timestamp at time zone 'UTC' and e.occurred_at < (v_week + 7)::timestamp at time zone 'UTC'
  group by 1 order by pg_catalog.count(*) desc, 1 limit 1;

  select pg_catalog.jsonb_build_object('title', l.title, 'taps', pg_catalog.sum(c.clicks)) into v_top_link
  from private.link_clicks_daily c join public.profile_links l on l.id = c.link_id
  where c.owner_profile_id = v_user and c.day >= v_week and c.day < v_week + 7
  group by l.id, l.title order by pg_catalog.sum(c.clicks) desc, l.title limit 1;

  select coalesce(pg_catalog.jsonb_agg(people.name order by people.created_at desc), '[]'::jsonb) into v_people
  from (
    select case when enc.shared_by_user_id = v_user then coalesce(creator.display_name, conn.guest_display_name, 'Someone')
             else coalesce(shared.display_name, 'Someone') end as name, enc.created_at
    from public.connection_encounters enc
    left join public.connections conn on conn.id = enc.connection_id
    left join public.profiles creator on creator.id = enc.created_by_user_id
    left join public.profiles shared on shared.id = enc.shared_by_user_id
    where (enc.shared_by_user_id = v_user or enc.created_by_user_id = v_user)
      and enc.created_at >= v_week::timestamp at time zone 'UTC' and enc.created_at < (v_week + 7)::timestamp at time zone 'UTC'
    order by enc.created_at desc limit 5
  ) people;

  return pg_catalog.jsonb_build_object(
    'weekStart', v_week::text, 'weekEnd', (v_week + 6)::text,
    'now', v_now, 'before', v_before,
    'topMode', v_top_mode, 'bestDay', v_best_day::text,
    'topLink', v_top_link, 'people', v_people);
end;
$function$;
revoke all on function public.get_weekly_digest(uuid) from public, anon, authenticated;
grant execute on function public.get_weekly_digest(uuid) to service_role;

-- Queues last week's digest for every confirmed member whose page saw a view, a scan, a tap or
-- a connection that week. The delivery key holds the week, so running it twice never sends twice.
create function private.enqueue_weekly_digests()
returns integer language plpgsql security definer set search_path = '' as $function$
declare
  v_week date := (pg_catalog.date_trunc('week', pg_catalog.statement_timestamp() at time zone 'UTC'))::date - 7;
  v_count integer := 0;
  v_user uuid;
begin
  for v_user in
    select active.owner from (
      select e.owner_profile_id as owner from private.product_analytics_events e
      where e.event_name in ('profile_viewed', 'quick_qr_scanned', 'tap_scanned', 'connection_created')
        and e.occurred_at >= v_week::timestamp at time zone 'UTC' and e.occurred_at < (v_week + 7)::timestamp at time zone 'UTC'
      union
      select c.owner_profile_id from private.link_clicks_daily c where c.day >= v_week and c.day < v_week + 7
    ) active
    join auth.users u on u.id = active.owner and u.email_confirmed_at is not null
    join public.profiles p on p.id = active.owner
    where not exists (select 1 from public.notification_preferences np where np.user_id = active.owner and not np.weekly_digest)
  loop
    if private.enqueue_notification(v_user, 'product', 'weekly_digest', 'weekly-digest:' || v_user::text || ':' || v_week::text) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$;
revoke all on function private.enqueue_weekly_digests() from public, anon, authenticated;

-- Mondays 07:47 UTC: morning in Europe, before the week fills up.
select cron.schedule('setuvara-weekly-digest', '47 7 * * 1', 'select private.enqueue_weekly_digests()');
