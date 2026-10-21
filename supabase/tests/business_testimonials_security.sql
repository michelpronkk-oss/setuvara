begin;

select plan(26);

-- A business owner on Plus, a rival business on Free, and a stranger.
create temporary table bt_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into bt_accounts select kind, id, 'bt_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('owner'),('rival'),('stranger')) v(kind)) s;
grant select on bt_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)||' Studio'),now(),now(),now() from bt_accounts;
update public.profiles set is_published=true where id in (select user_id from bt_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from bt_accounts);
create temporary table bt_vals(name text primary key, val text);
grant select, insert, update on bt_vals to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from bt_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.val(p_name text) returns text language sql as $$ select val from bt_vals where name=p_name $$;
create function pg_temp.uname(p_kind text) returns text language sql as $$ select username from bt_accounts where kind=p_kind $$;
create function pg_temp.say(p_token text, p_name text, p_body text, p_consent boolean default true) returns jsonb language sql as $$
  select public.submit_testimonial(p_token, p_name, 'Founder', 'Vos & Co', p_body, 5, p_consent)
$$;
grant execute on function pg_temp.as_user(text), pg_temp.val(text), pg_temp.uname(text), pg_temp.say(text,text,text,boolean) to anon, authenticated, service_role;

insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_BtOwner', user_id, 'cus_BtOwner', 'pdt_BtPlus', 'plus', 'monthly', 'active', 'bt-fixture', now(), now(), now() + interval '30 days' from bt_accounts where kind='owner';

-- A lead the owner wins, from a real Business inquiry.
set local role authenticated;
select pg_temp.as_user('owner');
with a as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'booking', 'Book a consult', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into bt_vals select 'booking', a.id::text from a;
reset role;
set local role service_role;
select public.submit_profile_action(pg_temp.val('booking')::uuid, null, 'Mara Vos', 'mara@example.test', '{"message":"Can we meet?"}', false, rpad('bt-mara',16,'0'), null);
reset role;
set local role authenticated;
select pg_temp.as_user('owner');
insert into bt_vals select 'lead', id::text from public.business_leads where email_norm='mara@example.test';
select public.set_business_lead_stage(pg_temp.val('lead')::uuid, 'won');

-- 1. Requests.
insert into bt_vals values ('won_token', public.create_testimonial_request(pg_temp.val('lead')::uuid, '')->>'token');
insert into bt_vals values ('open_token', public.create_testimonial_request(null, 'Jun Park')->>'token');
select ok(length(pg_temp.val('won_token')) >= 32, 'the owner gets a long private link');
select is((select name from public.business_testimonial_requests where lead_id = pg_temp.val('lead')::uuid), 'Mara Vos', 'a request for a lead takes the lead''s name');
select throws_ok($$ select token_hash from public.business_testimonial_requests $$, '42501', null, 'not even the owner can read the stored hash');
select pg_temp.as_user('stranger');
select is((select count(*) from public.business_testimonial_requests), 0::bigint, 'nobody else sees the requests');
select throws_ok($$ select public.create_testimonial_request(pg_temp.val('lead')::uuid, '') $$, 'P0002', 'lead_not_found', 'nobody else can ask on someone''s lead');
reset role;

-- 2. The invite page and the client's words.
set local role anon;
select is(public.get_testimonial_request(pg_temp.val('won_token'))->>'owner_name', 'Owner Studio', 'a live link shows who is asking');
select is(public.get_testimonial_request('not-a-real-token-at-all-000000'), null, 'a wrong link shows nothing');
select throws_ok($$ select pg_temp.say(pg_temp.val('won_token'), 'Mara', 'Long enough words for a real testimonial.') $$, '42501', null, 'a visitor cannot write straight to the database');
reset role;

set local role service_role;
select throws_ok($$ select pg_temp.say(pg_temp.val('won_token'), 'Mara Vos', 'Long enough words for a real testimonial.', false) $$, '22023', 'consent_required', 'nothing is kept without agreeing to be shown');
select throws_ok($$ select pg_temp.say(pg_temp.val('won_token'), 'Mara Vos', 'Too short.') $$, '22023', 'body_length', 'a few words are not a testimonial');
select lives_ok($$ select pg_temp.say(pg_temp.val('won_token'), 'Mara Vos', 'Lucas rebuilt our page in a week and bookings doubled.') $$, 'the client writes a testimonial');
select throws_ok($$ select pg_temp.say(pg_temp.val('won_token'), 'Mara Vos', 'A second go at writing the same testimonial.') $$, 'P0002', 'request_unavailable', 'a link works once');
select lives_ok($$ select pg_temp.say(pg_temp.val('open_token'), 'Jun Park', 'Clear, fast and kind. Would hire again tomorrow.') $$, 'a link without a lead works too');
select is((select status from public.business_testimonials where author_name='Mara Vos'), 'pending', 'it waits for the owner');
select is((select verified from public.business_testimonials where author_name='Mara Vos'), true, 'a Won lead is a verified client');
select is((select verified from public.business_testimonials where author_name='Jun Park'), false, 'a link without a Won lead is not');
reset role;

-- 3. The owner decides; only approved ones are public.
set local role anon;
select is(jsonb_array_length(public.get_public_testimonials(pg_temp.uname('owner'))), 0, 'nothing is public before approval');
reset role;
set local role authenticated;
select pg_temp.as_user('stranger');
select is(public.set_testimonial_status((select id from public.business_testimonials where author_name='Mara Vos'), 'approved'), false, 'nobody else can approve');
select pg_temp.as_user('owner');
select is(public.set_testimonial_status((select id from public.business_testimonials where author_name='Mara Vos'), 'approved'), true, 'the owner approves');
select public.set_testimonial_status((select id from public.business_testimonials where author_name='Jun Park'), 'hidden');
reset role;
set local role anon;
select is(public.get_public_testimonials(pg_temp.uname('owner'))->0->>'author_name', 'Mara Vos', 'approved testimonials are public');
select is(jsonb_array_length(public.get_public_testimonials(pg_temp.uname('owner'))), 1, 'hidden ones are not');
select throws_ok($$ select count(*) from public.business_testimonials $$, '42501', null, 'visitors only see what the page function gives');
reset role;

-- 4. Plans: Free shows three.
set local role authenticated;
select pg_temp.as_user('rival');
insert into bt_vals select 'rival'||g, public.create_testimonial_request(null, 'Client '||g)->>'token' from generate_series(1,4) g;
reset role;
set local role service_role;
select pg_temp.say(pg_temp.val('rival'||g), 'Client '||g, 'Number '||g||' says this was genuinely great work.') from generate_series(1,4) g;
reset role;
set local role authenticated;
select pg_temp.as_user('rival');
select public.set_testimonial_status(id, 'approved') from public.business_testimonials;
reset role;
set local role anon;
select is(jsonb_array_length(public.get_public_testimonials(pg_temp.uname('rival'))), 3, 'Free shows three approved testimonials');
reset role;

-- 5. Revoked and expired links stop working; a switched-off Business Mode shows nothing.
set local role authenticated;
select pg_temp.as_user('owner');
insert into bt_vals values ('revoked', public.create_testimonial_request(null, 'Ada')->>'token');
select public.revoke_testimonial_request((select id from public.business_testimonial_requests where name='Ada'));
reset role;
set local role anon;
select is(public.get_testimonial_request(pg_temp.val('revoked')), null, 'a revoked link shows nothing');
reset role;
update public.business_testimonial_requests set expires_at = now() - interval '1 minute' where name = 'Client 4' or name = 'Ada';
set local role authenticated;
select pg_temp.as_user('owner');
insert into bt_vals values ('late', public.create_testimonial_request(null, 'Late')->>'token');
reset role;
update public.business_testimonial_requests set expires_at = now() - interval '1 minute' where name = 'Late';
set local role service_role;
select throws_ok($$ select pg_temp.say(pg_temp.val('late'), 'Late', 'Words that arrive after the link has expired.') $$, 'P0002', 'request_unavailable', 'an expired link takes nothing');
reset role;
update public.profile_modes set is_enabled = false where slug = 'business' and profile_id = (select user_id from bt_accounts where kind='owner');
set local role anon;
select is(jsonb_array_length(public.get_public_testimonials(pg_temp.uname('owner'))), 0, 'a switched-off Business Mode shows none');
reset role;

select * from finish();
rollback;
