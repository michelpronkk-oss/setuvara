begin;

select plan(50);

select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_follows'::regclass), 'creator_follows has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_monetization_accounts'::regclass), 'creator_monetization_accounts has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_offers'::regclass), 'creator_offers has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_memberships'::regclass), 'creator_memberships has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_content_rules'::regclass), 'creator_content_rules has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_drops'::regclass), 'creator_drops has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_access_grants'::regclass), 'creator_access_grants has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_orders'::regclass), 'creator_orders has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_ledger_entries'::regclass), 'creator_ledger_entries has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_payout_accounts'::regclass), 'creator_payout_accounts has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_payouts'::regclass), 'creator_payouts has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_payment_events'::regclass), 'creator_payment_events has RLS');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.creator_fee_policies'::regclass), 'creator_fee_policies has RLS');

select ok(not has_table_privilege('anon','public.creator_follows','select'), 'anon cannot enumerate Creator followers');
select ok(not has_table_privilege('authenticated','public.creator_monetization_accounts','update'), 'clients cannot approve or verify monetization');
select ok(not has_table_privilege('authenticated','public.creator_orders','insert'), 'clients cannot create paid orders');
select ok(not has_table_privilege('authenticated','public.creator_orders','update'), 'clients cannot mark orders paid');
select ok(not has_table_privilege('authenticated','public.creator_access_grants','insert'), 'clients cannot create purchase grants');
select ok(not has_table_privilege('authenticated','public.creator_ledger_entries','insert'), 'clients cannot credit creator ledger');
select ok(not has_table_privilege('authenticated','public.creator_ledger_entries','update'), 'clients cannot mutate creator ledger');
select ok(not has_table_privilege('authenticated','public.creator_payouts','insert'), 'clients cannot create withdrawals');
select ok(not has_table_privilege('authenticated','public.creator_payment_events','insert'), 'clients cannot inject provider events');
select ok(not has_table_privilege('authenticated','public.creator_fee_policies','select'), 'fee policy internals are not directly exposed');

select ok(has_function_privilege('authenticated','public.creator_follow(uuid)','execute'), 'signed-in users can follow via guarded RPC');
select ok(has_function_privilege('authenticated','public.creator_unfollow(uuid)','execute'), 'signed-in users can unfollow via guarded RPC');
select ok(has_function_privilege('authenticated','public.creator_follower_count()','execute'), 'creator can read aggregate follower count');
select ok(not has_function_privilege('anon','public.creator_follower_count()','execute'), 'anonymous users cannot query owner follower-count RPC');
select ok(has_function_privilege('anon','public.get_creator_public_summary(text)','execute'), 'public creator summary is available to visitors');
select ok(has_function_privilege('authenticated','public.can_view_creator_block(uuid)','execute'), 'canonical access decision is callable');
select ok(has_function_privilege('authenticated','public.creator_monetization_enabled()','execute'), 'owner can query canonical monetization state');
select ok(not has_function_privilege('anon','public.creator_monetization_enabled()','execute'), 'anonymous visitors cannot probe monetization state');
select ok(has_function_privilege('authenticated','public.creator_submit_monetization_application(text,text)','execute'), 'users can submit applications without self-approval');
select ok(not has_function_privilege('authenticated','private.create_profile_for_new_user()','execute'), 'auth provisioning hook remains private');

select ok((select pg_catalog.pg_get_constraintdef(oid) like '%creator%' from pg_catalog.pg_constraint where conrelid='public.profile_modes'::regclass and conname='profile_modes_slug_check'), 'profile_modes accepts creator as a real Mode');

create temporary table creator_test_accounts(kind text primary key,user_id uuid not null unique,username text not null unique);
with ids as materialized (
  select kind,gen_random_uuid() as user_id from (values('creator'::text),('follower'::text)) accounts(kind)
)
insert into creator_test_accounts(kind,user_id,username)
select kind,user_id,'cr_'||substr(replace(user_id::text,'-',''),1,12) from ids;
grant select on creator_test_accounts to anon,authenticated;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',
  jsonb_build_object('username',username,'display_name',initcap(kind)),statement_timestamp(),statement_timestamp(),statement_timestamp()
from creator_test_accounts;
select is((select count(*)::integer from public.profile_modes m join creator_test_accounts a on a.user_id=m.profile_id where a.kind='creator' and m.slug='creator'),1,'new accounts receive a Creator profile_mode');
select is((select count(*)::integer from public.profile_modes m join creator_test_accounts a on a.user_id=m.profile_id where a.kind='creator' and m.slug='creator' and m.is_enabled),0,'new Creator Mode defaults disabled');
select is((select count(*)::integer from public.profile_modes m join creator_test_accounts a on a.user_id=m.profile_id where a.kind='creator' and m.slug in ('personal','event','business') and m.is_enabled),3,'new Personal, Event and Business provisioning remains enabled as before');
select ok((select c.id <> p.id from public.profile_modes c join creator_test_accounts a on a.user_id=c.profile_id and a.kind='creator' join public.profile_modes p on p.profile_id=c.profile_id and p.slug='personal' where c.slug='creator'),'Creator presentation is stored independently from Personal');

update public.profiles set is_published=true where id=(select user_id from creator_test_accounts where kind='creator');
update public.profile_modes set is_enabled=true where profile_id=(select user_id from creator_test_accounts where kind='creator') and slug='creator';
create temporary table creator_test_block(id uuid primary key);
with new_block as (insert into public.profile_blocks(profile_id,mode_id,kind,data,is_visible)
select m.profile_id,m.id,'feature','{"title":"Safe teaser title","private_body":"never expose this body"}'::jsonb,true
from public.profile_modes m where m.profile_id=(select user_id from creator_test_accounts where kind='creator') and m.slug='creator'
returning id)
insert into creator_test_block select id from new_block;
grant select on creator_test_block to anon,authenticated;
insert into public.creator_content_rules(profile_block_id,creator_user_id,access_level,teaser_title,teaser_text)
values((select id from creator_test_block),(select user_id from creator_test_accounts where kind='creator'),'followers','A safe preview','Public teaser only');
create temporary table creator_test_scheduled_block(id uuid primary key);
with new_block as (insert into public.profile_blocks(profile_id,mode_id,kind,data,is_visible)
  select m.profile_id,m.id,'feature','{"title":"Upcoming private block","private_body":"future secret"}'::jsonb,true
  from public.profile_modes m where m.profile_id=(select user_id from creator_test_accounts where kind='creator') and m.slug='creator'
  returning id)
insert into creator_test_scheduled_block select id from new_block;
grant select on creator_test_scheduled_block to anon,authenticated;
insert into public.creator_content_rules(profile_block_id,creator_user_id,access_level,teaser_title,teaser_text)
values((select id from creator_test_scheduled_block),(select user_id from creator_test_accounts where kind='creator'),'followers','Not released','Future teaser');
insert into public.creator_drops(creator_user_id,profile_block_id,title,status,starts_at)
values((select user_id from creator_test_accounts where kind='creator'),(select id from creator_test_scheduled_block),'Upcoming drop','scheduled',statement_timestamp()+interval '1 hour');

set local role anon;
select set_config('request.jwt.claims','{}',true);
select ok(not public.can_view_creator_block((select id from creator_test_block)),'anonymous visitor is denied the protected Creator block');
select is((select count(*)::integer from public.profile_blocks where id=(select id from creator_test_block)),0,'public RLS hides protected profile block payload');
select is((select teaser_text from public.creator_content_rules where profile_block_id=(select id from creator_test_block)),'Public teaser only','public RLS exposes only safe teaser metadata');
select is((select count(*)::integer from public.creator_content_rules where profile_block_id=(select id from creator_test_scheduled_block)),0,'scheduled Drop teaser stays hidden before release');
select ok((public.get_creator_public_summary((select username from creator_test_accounts where kind='creator'))->'locked_content')::text like '%Public teaser only%'
  and not (public.get_creator_public_summary((select username from creator_test_accounts where kind='creator'))->'locked_content')::text like '%never expose this body%'
  and not (public.get_creator_public_summary((select username from creator_test_accounts where kind='creator'))->'locked_content')::text like '%Future teaser%',
  'public Creator contract includes teaser but never protected block body');
select is(public.get_connect_access((select username from creator_test_accounts where kind='creator'),'creator',null),true,'existing Connection Access applies to Creator Mode');

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from creator_test_accounts where kind='follower'),'role','authenticated')::text,true);
select public.creator_follow((select user_id from creator_test_accounts where kind='creator'));
select ok(public.can_view_creator_block((select id from creator_test_block)),'a follower receives access through the canonical block decision');
select is((select count(*)::integer from public.connections where user_id=(select user_id from creator_test_accounts where kind='creator') and connected_user_id=(select user_id from creator_test_accounts where kind='follower')),0,'Follow creates no Setuvara Connection');
select is((select count(*)::integer from public.connection_encounters where shared_by_user_id=(select user_id from creator_test_accounts where kind='creator') and created_by_user_id=(select user_id from creator_test_accounts where kind='follower')),0,'Follow creates no Connection Encounter');
select ok(not has_table_privilege('anon','public.creator_follows','select'),'public follower identities remain inaccessible after follows exist');

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from creator_test_accounts where kind='creator'),'role','authenticated')::text,true);
select is(public.creator_follower_count(),1::bigint,'owner follower count includes audience without exposing identities');
select public.set_equipped_share_state('creator','view_profile');
select is(public.get_equipped_share_state()->>'mode','creator','opaque Quick QR and Tap equipment can target Creator Mode');

select * from finish();
rollback;
