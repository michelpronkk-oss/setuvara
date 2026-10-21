begin;
select plan(7);

create temporary table pa_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into pa_accounts select kind, id, 'pa_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('creator'),('buyer'),('other')) v(kind)) s;
grant select on pa_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from pa_accounts;
update public.profiles set is_published=true where id in (select user_id from pa_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from pa_accounts);
create function pg_temp.uid(p_kind text) returns uuid language sql as $$ select user_id from pa_accounts where kind=p_kind $$;
create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',pg_temp.uid(p_kind),'role','authenticated')::text, true);
$$;
create temporary table pa_ids(name text primary key, id uuid);
grant select on pa_ids to anon, authenticated, service_role;
grant execute on function pg_temp.uid(text), pg_temp.as_user(text) to anon, authenticated, service_role;

-- Fixture: a sellable offer (its seller checks are covered by creator_commerce_security).
set local session_replication_role = replica;
with x as (insert into public.creator_offers(creator_user_id,kind,offer_type,title,currency,unit_amount_minor,status)
  values (pg_temp.uid('creator'),'one_time','digital','Full session','EUR',900,'active') returning id) insert into pa_ids select 'offer', id from x;
set local session_replication_role = origin;
-- A Work piece locked behind it.
with x as (insert into public.profile_blocks(profile_id,mode_id,kind,data,is_visible)
  select m.profile_id, m.id, 'feature', '{"title":"Session"}', true from public.profile_modes m where m.profile_id=pg_temp.uid('creator') and m.slug='creator' returning id) insert into pa_ids select 'block', id from x;
insert into public.creator_content_rules(profile_block_id, creator_user_id, access_level, offer_id)
values ((select id from pa_ids where name='block'), pg_temp.uid('creator'), 'purchase', (select id from pa_ids where name='offer'));

-- A pending order, then paid (as the payment webhook does).
with x as (insert into public.creator_orders(creator_user_id,buyer_user_id,offer_id,currency,gross_amount_minor,platform_fee_bps,platform_fee_amount_minor,creator_net_amount_minor,idempotency_key)
  values (pg_temp.uid('creator'), pg_temp.uid('buyer'), (select id from pa_ids where name='offer'), 'EUR', 900, 0, 0, 900, 'pa-order-0000001') returning id) insert into pa_ids select 'order', id from x;
select is((select count(*) from public.creator_access_grants where order_id=(select id from pa_ids where name='order'))::integer, 0, 'a pending order grants nothing');

set local role authenticated;
select pg_temp.as_user('buyer');
select ok(not exists(select 1 from public.profile_blocks where id=(select id from pa_ids where name='block')), 'before paying, the piece stays locked');
reset role;

update public.creator_orders set status='paid', paid_at=now() where id=(select id from pa_ids where name='order');
select is((select count(*) from public.creator_access_grants where order_id=(select id from pa_ids where name='order') and user_id=pg_temp.uid('buyer') and source='purchase')::integer, 1, 'paying grants access to the buyer');
update public.creator_orders set status='paid' where id=(select id from pa_ids where name='order');
select is((select count(*) from public.creator_access_grants where order_id=(select id from pa_ids where name='order'))::integer, 1, 'once');

set local role authenticated;
select pg_temp.as_user('buyer');
select ok(exists(select 1 from public.profile_blocks where id=(select id from pa_ids where name='block')), 'the buyer now opens the piece');
select pg_temp.as_user('other');
select ok(not exists(select 1 from public.profile_blocks where id=(select id from pa_ids where name='block')), 'nobody else does');
reset role;

update public.creator_orders set status='refunded', refunded_at=now() where id=(select id from pa_ids where name='order');
set local role authenticated;
select pg_temp.as_user('buyer');
select ok(not exists(select 1 from public.profile_blocks where id=(select id from pa_ids where name='block')), 'a refund ends access');
reset role;

select * from finish();
rollback;
