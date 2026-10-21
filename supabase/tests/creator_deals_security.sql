begin;

select plan(22);

-- A creator on Plus, a Free creator, and a stranger.
create temporary table cd_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into cd_accounts select kind, id, 'cd_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('creator'),('free'),('stranger')) v(kind)) s;
grant select on cd_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from cd_accounts;
update public.profiles set is_published=true where id in (select user_id from cd_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from cd_accounts);
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at)
select 'sub_CdCreator', user_id, 'cus_CdCreator', 'pdt_CdPlus', 'plus', 'monthly', 'active', 'cd-fixture', now(), now() from cd_accounts where kind='creator';
create temporary table cd_ids(name text primary key, id uuid);
grant select, insert on cd_ids to anon, authenticated, service_role;

create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from cd_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from cd_accounts where kind=p_kind $$;
create function pg_temp.submit(p_action text, p_name text, p_email text, p_answers jsonb, p_key text) returns uuid language sql as $$
  select (public.submit_profile_action((select id from cd_ids where name=p_action), null, p_name, p_email, p_answers, false, rpad(p_key, 16, '0'), null)->>'id')::uuid
$$;
create function pg_temp.deal(p_brand text) returns uuid language sql as $$ select id from public.creator_deals where brand=p_brand $$;
grant execute on function pg_temp.as_user(text), pg_temp.uid(text), pg_temp.submit(text,text,text,jsonb,text), pg_temp.deal(text) to authenticated, service_role, anon;

set local role authenticated;
select pg_temp.as_user('creator');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'collab', 'Work with me', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator' returning id)
insert into cd_ids select 'creator_collab', id from x;
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'collab', 'Business collab', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='business' returning id)
insert into cd_ids select 'business_collab', id from x;
select pg_temp.as_user('free');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status)
  select m.profile_id, m.id, 'collab', 'Free collab', 'published' from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator' returning id)
insert into cd_ids select 'free_collab', id from x;
reset role;

set local role service_role;
select pg_temp.submit('creator_collab', 'Lena Brand', 'lena@oat.test', '{"message":"Spring campaign?","collabType":"campaign","budget":"5k_10k","company":"Oat Co"}', 'k-oat-1');
select pg_temp.submit('creator_collab', 'Lena Brand', 'lena@oat.test', '{"message":"Also UGC","collabType":"ugc","company":"Oat Co UGC"}', 'k-oat-2');
select pg_temp.submit('business_collab', 'Biz', 'biz@b.test', '{"message":"Hi","collabType":"campaign","company":"Biz Co"}', 'k-biz-1');
select pg_temp.submit('free_collab', 'Free Brand', 'f@f.test', '{"message":"Hi","collabType":"campaign","company":"Free Co"}', 'k-free-1');
select pg_temp.submit('creator_collab', 'Spam', 'spam@s.test', '{"message":"Buy","collabType":"other","company":"Spam Co"}', 'k-spam-1');
reset role;

select is((select count(*) from public.creator_deals where creator_user_id=pg_temp.uid('creator'))::integer, 3, 'every Creator Collab request is its own deal; Business ones are not deals');
select is((select collab_type||':'||stated_budget||':'||contact_email from public.creator_deals where id=pg_temp.deal('Oat Co')), 'campaign:5k_10k:lena@oat.test', 'the deal keeps the type, the stated budget and the contact');
select is((select stage from public.creator_deals where id=pg_temp.deal('Oat Co')), 'new', 'deals start as New');
select is((select count(*) from public.creator_deal_activities where deal_id=pg_temp.deal('Oat Co') and kind='created')::integer, 1, 'and their history starts');

set local role authenticated;
select pg_temp.as_user('creator');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='spam@s.test'), 'spam'), 'the creator marks a request as spam');
select is((select count(*) from public.creator_deals where brand='Spam Co')::integer, 0, 'an untouched deal from spam goes');
select ok(public.set_action_submission_status((select id from public.action_submissions where email='spam@s.test'), 'new'), 'and un-marks it');
select is((select count(*) from public.creator_deals where brand='Spam Co')::integer, 1, 'the deal comes back');

select is(public.set_creator_deal_stage(pg_temp.deal('Oat Co'), 'talking')->>'stage', 'talking', 'New to Talking');
select is(public.set_creator_deal_stage(pg_temp.deal('Oat Co'), 'booked')->>'stage', 'booked', 'Talking to Booked');
select is((select string_agg(from_stage||'>'||to_stage, ',' order by created_at) from public.creator_deal_activities where deal_id=pg_temp.deal('Oat Co') and kind='stage'), 'new>talking,talking>booked', 'each move is in the history');
select throws_ok($$select public.set_creator_deal_stage(pg_temp.deal('Oat Co'), 'invoiced')$$, '22023', 'invalid_stage', 'only the pipeline stages exist');
select is(public.set_creator_deal_amount(pg_temp.deal('Oat Co'), 450000, 'eur')->>'changed', 'true', 'the creator records the fee they agreed');
select is((select agreed_amount_cents||' '||currency from public.creator_deals where id=pg_temp.deal('Oat Co')), '450000 EUR', 'in their own currency');
select throws_ok($$select public.set_creator_deal_amount(pg_temp.deal('Oat Co'), 100, null)$$, '22023', 'invalid_amount', 'an amount needs a currency');
select is(public.set_creator_deal_stage(pg_temp.deal('Oat Co UGC'), 'declined', 'Not a fit')->>'stage', 'declined', 'a deal can be declined with a reason');
select isnt(public.add_creator_deal_note(pg_temp.deal('Oat Co'), 'Contract signed', 'deal-note-000000001'), null, 'Plus creators add notes');
select is(public.add_creator_deal_note(pg_temp.deal('Oat Co'), 'Contract signed', 'deal-note-000000001'), (select id from public.creator_deal_activities where kind='note'), 'a retried note is one note');

select pg_temp.as_user('free');
select throws_ok($$select public.add_creator_deal_note((select id from public.creator_deals where creator_user_id=auth.uid()), 'x', 'deal-note-000000009')$$, 'P0001', 'notes_require_plus', 'notes need Plus');

select pg_temp.as_user('stranger');
select is((select count(*) from public.creator_deals)::integer, 0, 'another member reads no deals');
select throws_ok($$select public.set_creator_deal_stage((select id from cd_ids where name='creator_collab'), 'paid')$$, 'P0002', 'deal_not_found', 'another member cannot move a deal');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.creator_deals$$, '42501', null, 'visitors cannot read deals');
reset role;

select * from finish();
rollback;
