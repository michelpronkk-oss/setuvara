-- Premium Action Templates ("goals").
--
-- A goal is a configuration of what already exists, never a new engine. Picking one and answering
-- a few questions creates ordinary, fully editable drafts in one transaction: Actions (with their
-- thank-you screen), an Event, a Commerce product. The owner reviews and publishes them as usual,
-- so every existing rule still applies: plan limits on publishing (profile_actions_validate),
-- event checks, product checks, payments-before-paid-products.
--
--   * goal_setups records what a goal created, keyed by an idempotency key (one click, one setup).
--   * private.goal_templates says which Mode each goal belongs to and the plan it needs:
--     one starter goal per Mode on Free, the full library on Plus and Pro.
--   * apply_goal_setup takes the prepared rows, writes only the columns a goal may set, forces
--     every record to draft, and refuses anything outside the owner's own Mode.
--   * goal_progress reports, per setup, each record's state and how many people responded.

create table private.goal_templates (
  template text primary key check (template ~ '^[a-z][a-z_]{2,39}$'),
  mode_slug text not null check (mode_slug in ('personal','business','creator','event')),
  min_plan text not null check (min_plan in ('free','plus','pro'))
);
insert into private.goal_templates values
  ('meet_connect','personal','free'), ('ask_me_anything','personal','plus'), ('grow_network','personal','plus'),
  ('get_more_clients','business','free'), ('book_consultation','business','plus'), ('collect_feedback','business','plus'),
  ('grow_audience','creator','free'), ('launch_product','creator','plus'), ('reward_fans','creator','plus'),
  ('host_event','event','free'), ('grow_attendance','event','plus'), ('after_event','event','plus');
revoke all on private.goal_templates from public, anon, authenticated;

create table public.goal_setups (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid not null references public.profile_modes(id) on delete cascade,
  template text not null references private.goal_templates(template),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 8000),
  records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (profile_id, idempotency_key)
);
create index goal_setups_owner_idx on public.goal_setups (profile_id, created_at desc);
alter table public.goal_setups enable row level security;
revoke all on public.goal_setups from public, anon, authenticated;
grant select on public.goal_setups to authenticated;
grant all on public.goal_setups to service_role;
create policy goal_setups_owner_read on public.goal_setups for select to authenticated using (profile_id = (select auth.uid()));

create function public.goal_template_access()
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_object_agg(t.template, case private.member_plan(auth.uid())
      when 'pro' then true when 'plus' then t.min_plan <> 'pro' else t.min_plan = 'free' end), '{}'::jsonb)
  from private.goal_templates t where auth.uid() is not null
$function$;

create function public.apply_goal_setup(p_mode_id uuid, p_template text, p_idempotency_key text, p_answers jsonb,
  p_actions jsonb, p_event jsonb default null, p_offer jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_uid uuid := auth.uid();
  v_mode public.profile_modes;
  v_tpl private.goal_templates;
  v_plan text;
  v_existing public.goal_setups;
  v_records jsonb := '[]'::jsonb;
  v_item jsonb;
  v_id uuid;
  v_sort integer;
  v_setup uuid;
begin
  if v_uid is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception using errcode='22023', message='invalid_request'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text || ':' || p_idempotency_key, 11));
  select * into v_existing from public.goal_setups where profile_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return jsonb_build_object('id', v_existing.id, 'records', v_existing.records, 'duplicate', true); end if;

  select * into v_tpl from private.goal_templates where template = p_template;
  if not found then raise exception using errcode='22023', message='unknown_goal'; end if;
  select * into v_mode from public.profile_modes where id = p_mode_id and profile_id = v_uid;
  if not found or v_mode.slug <> v_tpl.mode_slug then raise exception using errcode='42501', message='mode_not_owned'; end if;
  v_plan := private.member_plan(v_uid);
  if (v_tpl.min_plan = 'plus' and v_plan = 'free') or (v_tpl.min_plan = 'pro' and v_plan <> 'pro') then
    raise exception using errcode='P0001', message='goal_requires_plus';
  end if;
  if jsonb_typeof(coalesce(p_actions, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_actions, '[]'::jsonb)) > 3
     or (p_event is not null and jsonb_typeof(p_event) <> 'object') or (p_offer is not null and jsonb_typeof(p_offer) <> 'object')
     or (jsonb_array_length(coalesce(p_actions, '[]'::jsonb)) = 0 and p_event is null and p_offer is null) then
    raise exception using errcode='22023', message='invalid_goal';
  end if;

  -- Actions: drafts, after the Mode's existing ones.
  select coalesce(max(a.sort_order), -1) into v_sort from public.profile_actions a where a.mode_id = v_mode.id;
  for v_item in select value from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) loop
    v_sort := least(v_sort + 1, 1000);
    insert into public.profile_actions (profile_id, mode_id, kind, title, intro, cta_label, config, status, sort_order, starts_at, ends_at)
    values (v_uid, v_mode.id, v_item->>'kind', v_item->>'title', coalesce(v_item->>'intro', ''), coalesce(v_item->>'cta_label', ''),
      coalesce(v_item->'config', '{}'::jsonb), 'draft', v_sort, (v_item->>'starts_at')::timestamptz, (v_item->>'ends_at')::timestamptz)
    returning id into v_id;
    if nullif(btrim(coalesce(v_item->>'thanks_heading', '')), '') is not null then
      insert into public.action_thanks (action_id, profile_id, heading) values (v_id, v_uid, pg_catalog.left(v_item->>'thanks_heading', 60));
    end if;
    v_records := v_records || jsonb_build_object('type', 'action', 'id', v_id, 'kind', v_item->>'kind');
  end loop;

  if p_event is not null then
    insert into public.events (profile_id, mode_id, title, summary, starts_at, ends_at, timezone, venue_name, city, capacity, waitlist_enabled, status)
    values (v_uid, v_mode.id, p_event->>'title', coalesce(p_event->>'summary', ''), (p_event->>'starts_at')::timestamptz,
      (p_event->>'ends_at')::timestamptz, coalesce(nullif(p_event->>'timezone', ''), 'Europe/Amsterdam'), coalesce(p_event->>'venue_name', ''),
      coalesce(p_event->>'city', ''), (p_event->>'capacity')::integer, coalesce((p_event->>'waitlist_enabled')::boolean, true), 'draft')
    returning id into v_id;
    v_records := v_records || jsonb_build_object('type', 'event', 'id', v_id);
  end if;

  if p_offer is not null then
    insert into public.creator_offers (creator_user_id, kind, offer_type, title, description, currency, unit_amount_minor, status)
    values (v_uid, 'one_time', coalesce(p_offer->>'offer_type', 'digital'), p_offer->>'title', coalesce(p_offer->>'description', ''),
      p_offer->>'currency', (p_offer->>'unit_amount_minor')::bigint, 'draft')
    returning id into v_id;
    v_records := v_records || jsonb_build_object('type', 'offer', 'id', v_id);
  end if;

  insert into public.goal_setups (profile_id, mode_id, template, idempotency_key, answers, records)
    values (v_uid, v_mode.id, p_template, p_idempotency_key, coalesce(p_answers, '{}'::jsonb), v_records)
    returning id into v_setup;
  return jsonb_build_object('id', v_setup, 'records', v_records, 'duplicate', false);
end;
$function$;

-- Per setup: each record's current state and how many people it reached so far.
create function public.goal_progress()
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'template', g.template, 'mode_slug', m.slug, 'created_at', g.created_at,
      'records', coalesce((select jsonb_agg(x.item) from jsonb_array_elements(g.records) r
        cross join lateral (
          select jsonb_build_object('type', 'action', 'id', a.id, 'kind', a.kind, 'title', a.title, 'status', a.status,
              'responses', (select count(*) from public.action_submissions s where s.action_id = a.id and s.status not in ('spam','pending_verification'))) item
            from public.profile_actions a where r->>'type' = 'action' and a.id = (r->>'id')::uuid
          union all
          select jsonb_build_object('type', 'event', 'id', e.id, 'title', e.title, 'status', e.status, 'responses', e.confirmed_count + e.waitlist_count)
            from public.events e where r->>'type' = 'event' and e.id = (r->>'id')::uuid
          union all
          select jsonb_build_object('type', 'offer', 'id', o.id, 'title', o.title, 'status', o.status,
              'responses', (select count(*) from public.creator_orders c where c.offer_id = o.id and c.status in ('paid','partially_refunded')))
            from public.creator_offers o where r->>'type' = 'offer' and o.id = (r->>'id')::uuid
        ) x), '[]'::jsonb))
    order by g.created_at desc), '[]'::jsonb)
  from public.goal_setups g join public.profile_modes m on m.id = g.mode_id
  where g.profile_id = auth.uid()
$function$;

revoke all on function public.apply_goal_setup(uuid, text, text, jsonb, jsonb, jsonb, jsonb), public.goal_progress(), public.goal_template_access() from public, anon;
grant execute on function public.apply_goal_setup(uuid, text, text, jsonb, jsonb, jsonb, jsonb), public.goal_progress(), public.goal_template_access() to authenticated;

comment on table public.goal_setups is 'What an Action Template (goal) created: ordinary draft records, keyed by idempotency key. Owner-read; written by apply_goal_setup.';
