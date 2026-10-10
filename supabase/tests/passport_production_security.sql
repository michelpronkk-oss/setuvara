begin;

select no_plan();

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.passport_presentation_preferences'::regclass),
  'Passport presentation preferences have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.passport_stamps', 'select'), 'anon cannot read private stamp history');
select ok(not has_table_privilege('authenticated', 'public.passport_stamps', 'insert,update,delete'), 'owners cannot write stamps directly');
select ok(not has_table_privilege('anon', 'public.passport_presentation_preferences', 'select,insert,update,delete'), 'anon cannot read or change private presentation preferences');
select ok(not has_table_privilege('authenticated', 'public.passport_presentation_preferences', 'insert,update,delete'), 'owners can change presentation preferences only through validated RPCs');
select ok(not has_function_privilege('anon', 'private.passport_normalize_context(text)', 'execute'), 'normalization helper is not exposed');
select ok(not has_function_privilege('authenticated', 'private.passport_context_stamp_key(text,text,text,text)', 'execute'), 'stamp key helper is not exposed');
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_catalog.pg_proc where oid = function_name::regprocedure),
  format('%s is SECURITY DEFINER with a locked search_path', function_name)
)
from (values
  ('public.set_passport_cover(text)'::text),
  ('public.set_passport_reward(text,text)'::text),
  ('public.set_passport_member_finish(boolean)'::text),
  ('public.set_passport_featured_stamp(uuid)'::text),
  ('public.get_public_passport_featured_stamp(text)'::text),
  ('private.passport_user_has_member_plan(uuid)'::text)
) as functions(function_name);
select ok(has_function_privilege('authenticated', 'public.get_passport_stamp_page(timestamptz,uuid,integer)', 'execute'), 'authenticated owners can paginate their stamps');
select ok(not has_function_privilege('anon', 'public.get_passport_stamp_page(timestamptz,uuid,integer)', 'execute'), 'anon cannot paginate private stamps');
select ok(has_function_privilege('anon', 'public.get_public_passport_featured_stamp(text)', 'execute'), 'public profiles may expose one deliberately selected stamp');
select ok(not has_function_privilege('anon', 'public.set_passport_cover(text)', 'execute'), 'anon cannot set a Passport cover');

create temporary table passport_test_accounts (
  name text primary key,
  user_id uuid not null unique,
  username text not null unique
);
insert into passport_test_accounts (name, user_id, username)
select account.name, account.user_id,
       'pp_' || account.name || '_' || pg_catalog.substr(pg_catalog.replace(account.user_id::text, '-', ''), 1, 8)
from (select labels.name, pg_catalog.gen_random_uuid() as user_id from (values ('owner'), ('other'), ('pro')) labels(name)) account;
grant select on passport_test_accounts to authenticated, anon;

insert into auth.users (id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
select user_id, 'authenticated', 'authenticated', username || '@example.test',
       pg_catalog.jsonb_build_object('username', username, 'display_name', pg_catalog.initcap(name)),
       pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from passport_test_accounts;

insert into public.billing_subscriptions (
  dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id,
  plan_code, billing_interval, provider_status, last_provider_event_id,
  last_provider_event_at, last_sync_started_at
)
select 'sub_PassportOwner', user_id, 'cus_PassportOwner', 'pdt_PassportPlus',
       'plus', 'monthly', 'active', 'passport-fixture-active',
       pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from passport_test_accounts where name = 'owner';

insert into public.billing_subscriptions (
  dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id,
  plan_code, billing_interval, provider_status, last_provider_event_id,
  last_provider_event_at, last_sync_started_at
)
select 'sub_PassportPro', user_id, 'cus_PassportPro', 'pdt_PassportProMonthly',
       'pro', 'monthly', 'active', 'passport-fixture-pro-active',
       pg_catalog.statement_timestamp(), pg_catalog.statement_timestamp()
from passport_test_accounts where name = 'pro';

insert into public.passport_entitlements(user_id, reward_id)
select user_id, 'paper_passport_cover'
from passport_test_accounts where name = 'owner';

insert into public.passport_stamps(user_id, stamp_type, context_key, title, subtitle, earned_at)
select (select user_id from passport_test_accounts where name = 'owner'), 'city',
       'passport-page-' || pg_catalog.lpad(series.number::text, 3, '0'),
       'Place ' || series.number, '2026', pg_catalog.statement_timestamp()
from generate_series(1, 120) as series(number);
insert into public.passport_stamps(user_id, stamp_type, context_key, title, subtitle, country_code)
values (
  (select user_id from passport_test_accounts where name = 'owner'),
  'event', 'fi|helsinki|slush', 'Slush', 'Helsinki, FI · 2026', 'FI'
), (
  (select user_id from passport_test_accounts where name = 'owner'),
  'city', 'fi|helsinki', 'Helsinki', 'FI · 2026', 'FI'
), (
  (select user_id from passport_test_accounts where name = 'other'),
  'city', '|private-place', 'Private Place', null, null
), (
  (select user_id from passport_test_accounts where name = 'pro'),
  'event', 'pro|design-week', 'Design Week', '2026', null
);
create temporary table passport_test_stamp_ids (name text primary key, stamp_id uuid not null);
insert into passport_test_stamp_ids(name, stamp_id)
select 'owner_featured', id
from public.passport_stamps
where user_id = (select user_id from passport_test_accounts where name = 'owner') and title = 'Slush'
order by id
limit 1;
insert into passport_test_stamp_ids(name, stamp_id)
select 'pro_featured', id
from public.passport_stamps
where user_id = (select user_id from passport_test_accounts where name = 'pro') and title = 'Design Week'
order by id
limit 1;
grant select on passport_test_stamp_ids to authenticated;

-- Normalized values preserve Unicode, collapse whitespace, and make city/event
-- identity context-aware without country inference.
select private.add_passport_context_stamps(
  (select user_id from passport_test_accounts where name = 'owner'),
  'SLUSH', '  Helsinki  Central ', 'fi', timestamptz '2026-10-01 12:00:00+00'
);
select private.add_passport_context_stamps(
  (select user_id from passport_test_accounts where name = 'owner'),
  ' slush ', 'helsinki Central', 'FI', timestamptz '2026-10-02 12:00:00+00'
);
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'event' and context_key = 'FI|helsinki central|slush'), 1, 'case and spacing variants deduplicate the same event');
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'city' and context_key = 'FI|helsinki central'), 1, 'city keys include known country context');

select private.add_passport_context_stamps((select user_id from passport_test_accounts where name = 'owner'), 'Tech Week', 'Berlin', 'DE', now());
select private.add_passport_context_stamps((select user_id from passport_test_accounts where name = 'owner'), 'Tech Week', 'Berlin', 'US', now());
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'city' and title = 'Berlin'), 2, 'same city name in different countries remains distinct');
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'event' and title = 'Tech Week'), 2, 'same event title in different city/country context remains distinct');

select private.add_passport_context_stamps((select user_id from passport_test_accounts where name = 'owner'), 'Fête du livre', 'Québec', 'CA', now());
select private.add_passport_context_stamps((select user_id from passport_test_accounts where name = 'owner'), 'Fête du livre', 'Québec', 'ca', now());
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'city' and context_key = 'CA|québec'), 1, 'composed and decomposed Unicode city names normalize to one stamp');
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'event' and context_key = 'CA|québec|fête du livre'), 1, 'composed and decomposed Unicode event names normalize to one stamp');

select private.add_passport_context_stamps((select user_id from passport_test_accounts where name = 'owner'), 'Unverified festival', 'Somewhere', 'ZZ', now());
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'country' and context_key = 'ZZ'), 0, 'non-ISO country values do not create Country stamps');
select is((select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type in ('city','event') and country_code = 'ZZ'), 0, 'non-ISO country values are not attached to City or Event stamps');

select private.add_passport_context_stamps(
  (select user_id from passport_test_accounts where name = 'owner'),
  repeat('界', 100), repeat('東京', 40), 'JP', timestamptz '2026-10-03 12:00:00+00'
);
select ok(
  pg_catalog.char_length(private.passport_context_stamp_key('event', repeat('界', 100), repeat('東京', 40), 'JP')) <= 120,
  'maximum-length Unicode event and city context stays within the indexed key limit'
);
select is(
  (select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'city' and title = repeat('東京', 40)),
  1,
  'maximum-length Unicode city remains fully preserved in its visible title'
);
select is(
  (select pg_catalog.char_length(context_key)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner') and stamp_type = 'event' and title = repeat('界', 100)),
  120,
  'maximum-length event uses a bounded hash key without truncating its visible title'
);

create temporary table passport_page_ids (stamp_id uuid not null);
grant select, insert on passport_page_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from passport_test_accounts where name = 'owner'), 'role', 'authenticated'
)::text, true);

select is((select count(*)::integer from public.passport_stamps), (select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'owner')), 'owner reads only their own Passport stamps');
select throws_ok(
  $$insert into public.passport_stamps(user_id, stamp_type, context_key, title) values ((select user_id from passport_test_accounts where name = 'owner'), 'city', 'forged', 'Forged')$$,
  '42501', null, 'owner cannot create a stamp through the Data API'
);
select lives_ok($$select public.set_passport_cover('standard')$$, 'standard cover is available without a milestone');
select is((public.get_passport_overview() -> 'presentation' ->> 'memberFinishEnabled'), null::text, 'unset finish follows the resolved member plan by default');
select throws_ok($$select public.set_passport_cover('thousand_cover')$$, '42501', null, 'locked cover cannot be equipped before its milestone');
select lives_ok($$select public.set_passport_reward('passport_cover', 'paper_passport_cover')$$, 'legacy earned-cover control remains available');
select is((public.get_passport_overview() -> 'presentation' ->> 'coverId'), 'paper_passport_cover', 'legacy cover selection updates the Passport presentation');
select lives_ok($$select public.set_passport_cover('paper_passport_cover')$$, 'new cover control remains available for earned covers');
select is((select reward_id from public.passport_preferences where user_id = (select user_id from passport_test_accounts where name = 'owner') and category = 'passport_cover'), 'paper_passport_cover', 'Passport cover selection stays in sync with Identity rewards');
select lives_ok($$select public.set_passport_cover('standard')$$, 'owner can return to the Standard cover');
select is((select count(*)::integer from public.passport_preferences where user_id = (select user_id from passport_test_accounts where name = 'owner') and category = 'passport_cover'), 0, 'Standard cover clears the legacy equipped-cover preference');
select lives_ok($$select public.set_passport_member_finish(true)$$, 'active Plus owner can enable Member finish');
select ok((select member_finish_enabled from public.passport_presentation_preferences where user_id = (select user_id from passport_test_accounts where name = 'owner')), 'owner finish preference persists');
select lives_ok(
  $$select public.set_passport_featured_stamp((select stamp_id from passport_test_stamp_ids where name = 'owner_featured'))$$,
  'Plus owner may select one of their own stamps'
);
select is((public.get_passport_overview() -> 'presentation' ->> 'coverId'), 'standard', 'overview includes selected cover state');
select is((public.get_passport_overview() -> 'presentation' ->> 'memberFinishEnabled'), 'true', 'overview preserves Member finish preference');
select is((public.get_passport_overview() -> 'presentation' ->> 'featuredStampId'), (select stamp_id::text from passport_test_stamp_ids where name = 'owner_featured'), 'overview returns the selected stamp only to its owner');

create temporary table passport_page_payloads (page_number integer primary key, payload jsonb not null);
grant select, insert on passport_page_payloads to authenticated;
insert into passport_page_payloads values (1, public.get_passport_stamp_page(null, null, 50));
select is(jsonb_array_length(public.get_passport_overview() -> 'stamps'), 100, 'overview remains a bounded recent view');
select is(jsonb_array_length((select payload -> 'items' from passport_page_payloads where page_number = 1)), 50, 'first stamp page contains the requested size');
select is((select payload ->> 'hasMore' from passport_page_payloads where page_number = 1), 'true', 'first stamp page reports remaining history');

do $page_through$
declare
  v_page jsonb;
  v_cursor jsonb;
  v_number integer := 1;
begin
  v_page := (select payload from passport_page_payloads where page_number = 1);
  loop
    insert into passport_page_ids(stamp_id)
    select (items.stamp ->> 'id')::uuid
    from pg_catalog.jsonb_array_elements(v_page -> 'items') as items(stamp);
    exit when v_page ->> 'hasMore' <> 'true';
    v_cursor := v_page -> 'nextCursor';
    v_number := v_number + 1;
    v_page := public.get_passport_stamp_page((v_cursor ->> 'earnedAt')::timestamptz, (v_cursor ->> 'id')::uuid, 50);
    insert into passport_page_payloads(page_number, payload) values (v_number, v_page);
  end loop;
end;
$page_through$;

select is((select count(*)::integer from passport_page_ids), (select count(*)::integer from public.passport_stamps), 'keyset pages expose the complete collection');
select is((select count(distinct stamp_id)::integer from passport_page_ids), (select count(*)::integer from public.passport_stamps), 'keyset pages have no duplicates or gaps');
select is((select payload ->> 'hasMore' from passport_page_payloads order by page_number desc limit 1), 'false', 'last stamp page closes the collection');

select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from passport_test_accounts where name = 'other'), 'role', 'authenticated'
)::text, true);
select is((select count(*)::integer from public.passport_stamps), (select count(*)::integer from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'other')), 'second account reads only its own stamps');
select throws_ok($$select public.set_passport_member_finish(true)$$, '42501', null, 'Free account cannot grant itself Member finish');
select throws_ok($$select public.set_passport_featured_stamp((select stamp_id from passport_test_stamp_ids where name = 'owner_featured'))$$, '42501', null, 'Free account cannot feature another account stamp');
select throws_ok($$select public.set_passport_featured_stamp((select id from public.passport_stamps where user_id = (select user_id from passport_test_accounts where name = 'other') limit 1))$$, '42501', null, 'Free account cannot enable featured stamp');
select throws_ok(
  $$update public.passport_presentation_preferences set cover_id = 'thousand_cover' where user_id = (select user_id from passport_test_accounts where name = 'owner')$$,
  '42501', null, 'second account cannot change owner presentation settings directly'
);

select set_config('request.jwt.claims', pg_catalog.json_build_object(
  'sub', (select user_id from passport_test_accounts where name = 'pro'), 'role', 'authenticated'
)::text, true);
select lives_ok($$select public.set_passport_member_finish(true)$$, 'active Pro owner can enable Member finish');
select lives_ok(
  $$select public.set_passport_featured_stamp((select stamp_id from passport_test_stamp_ids where name = 'pro_featured'))$$,
  'active Pro owner may select one of their own stamps'
);

reset role;
update public.profiles set is_published = true where id = (select user_id from passport_test_accounts where name = 'owner');

set local role anon;
select is(public.get_public_passport_featured_stamp((select username from passport_test_accounts where name = 'owner')) ->> 'title', 'Slush', 'published paid profile exposes only the deliberately selected stamp');
select ok(not (public.get_public_passport_featured_stamp((select username from passport_test_accounts where name = 'owner')) ? 'key'), 'public featured stamp does not expose its internal context key');
select ok(not (public.get_public_passport_featured_stamp((select username from passport_test_accounts where name = 'owner')) ? 'earnedAt'), 'public featured stamp does not expose private earned history');
select throws_ok($$select * from public.passport_stamps$$, '42501', null, 'anon cannot query Passport stamp history');
reset role;
update public.profiles set is_published = false where id = (select user_id from passport_test_accounts where name = 'owner');
set local role anon;
select is(public.get_public_passport_featured_stamp((select username from passport_test_accounts where name = 'owner')), null::jsonb, 'unpublished profile exposes no featured stamp');
reset role;

select * from finish();
rollback;
