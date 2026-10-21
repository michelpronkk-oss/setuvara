begin;

select plan(19);

create temporary table gd_accounts(kind text primary key, user_id uuid not null unique, username text not null unique);
insert into gd_accounts select kind, id, 'gd_'||substr(replace(id::text,'-',''),1,12)
from (select kind, gen_random_uuid() id from (values('creator'),('stranger')) v(kind)) s;
grant select on gd_accounts to anon, authenticated, service_role;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated',username||'@example.test',jsonb_build_object('username',username,'display_name',initcap(kind)),now(),now(),now() from gd_accounts;
update public.profiles set is_published=true where id in (select user_id from gd_accounts);
update public.profile_modes set is_enabled=true where profile_id in (select user_id from gd_accounts);
insert into public.billing_subscriptions (dodo_subscription_id, user_id, dodo_customer_id, dodo_product_id, plan_code, billing_interval, provider_status, last_provider_event_id, last_provider_event_at, last_sync_started_at, current_period_end)
select 'sub_GdCreator', user_id, 'cus_GdCreator', 'pdt_GdPlus', 'plus', 'monthly', 'active', 'gd-fixture', now(), now(), now() + interval '30 days' from gd_accounts where kind='creator';
create temporary table gd_ids(name text primary key, id uuid);
grant select, insert on gd_ids to anon, authenticated, service_role;
create function pg_temp.as_user(p_kind text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub',(select user_id from gd_accounts where kind=p_kind),'role','authenticated')::text, true);
$$;
create function pg_temp.give() returns uuid language sql as $$ select id from gd_ids where name='giveaway' $$;
grant execute on function pg_temp.as_user(text), pg_temp.give() to authenticated, service_role, anon;

set local role authenticated;
select pg_temp.as_user('creator');
with x as (insert into public.profile_actions(profile_id,mode_id,kind,title,status,ends_at,config)
  select m.profile_id, m.id, 'giveaway', 'Win a print', 'published', now() + interval '1 day', '{"prize":"A signed print"}'::jsonb
  from public.profile_modes m where m.profile_id=auth.uid() and m.slug='creator' returning id)
insert into gd_ids select 'giveaway', id from x;
reset role;

-- Six entrants confirm, one never does.
set local role service_role;
select public.confirm_action_entry(public.submit_profile_action(pg_temp.give(), null, n, lower(replace(n,' ','.'))||'@example.test', '{}', false, rpad('gd-'||lower(replace(n,' ','')), 16, '0'), null)->>'verify_token')
from unnest(array['Mara Vos','Jun Park','Ada Lovelace','Kim','Lee Ann Smith','Noor Haddad']) n;
select public.submit_profile_action(pg_temp.give(), null, 'Never Confirmed', 'never@example.test', '{}', false, 'gd-never000000000', null);
reset role;
select is((select count(*) from public.action_submissions where action_id=pg_temp.give() and status='entered')::integer, 6, 'six confirmed entries');

set local role authenticated;
select pg_temp.as_user('creator');
select throws_ok($$select public.draw_giveaway_winners(pg_temp.give(), 1)$$, 'P0001', 'giveaway_not_ended', 'no draw before the end');
reset role;
-- Fixture only: the giveaway ends now (its terms are locked once live, so skip the lock trigger).
set local session_replication_role = replica;
update public.profile_actions set ends_at = now() - interval '1 minute' where id = pg_temp.give();
set local session_replication_role = origin;

set local role authenticated;
select pg_temp.as_user('stranger');
select throws_ok($$select public.draw_giveaway_winners(pg_temp.give(), 1)$$, 'P0002', 'giveaway_not_found', 'only the owner draws');
select pg_temp.as_user('creator');
select throws_ok($$select public.draw_giveaway_winners(pg_temp.give(), 11)$$, '22023', 'invalid_winners', 'one to ten winners');
select is((public.draw_giveaway_winners(pg_temp.give(), 2)->>'eligible_count')::integer, 6, 'the draw counts only confirmed entries');
select is((select cardinality(winner_submission_ids) from public.action_giveaway_draws where action_id=pg_temp.give() and draw_number=1), 2, 'two winners as asked');
select ok((select bool_and(s.status='entered' and s.verified_at is not null) from public.action_giveaway_draws d, unnest(d.winner_submission_ids) w(id) join public.action_submissions s on s.id=w.id where d.action_id=pg_temp.give()), 'every winner is a confirmed entry');
select ok((select seed ~ '^[0-9a-f]{64}$' and eligible_digest ~ '^[0-9a-f]{64}$' from public.action_giveaway_draws where action_id=pg_temp.give() and draw_number=1), 'the draw keeps its seed and the digest of the eligible list');

-- Anyone holding the seed and the list gets the same winners.
select is((select winner_submission_ids from public.action_giveaway_draws where action_id=pg_temp.give() and draw_number=1),
  (select array_agg(x.id order by public.giveaway_draw_rank(d.seed, x.id), x.id) from public.action_giveaway_draws d,
     lateral (select s.id from public.action_submissions s where s.action_id=d.action_id and s.status='entered' order by public.giveaway_draw_rank(d.seed, s.id), s.id limit 2) x
   where d.action_id=pg_temp.give() and d.draw_number=1),
  'the draw re-checks from its seed');
select is((select eligible_digest from public.action_giveaway_draws where action_id=pg_temp.give() and draw_number=1),
  (select encode(extensions.digest(array_to_string(array_agg(id order by id), ','), 'sha256'), 'hex') from public.action_submissions where action_id=pg_temp.give() and status='entered'),
  'and the digest matches the eligible entries');

-- A redraw needs a reason and never picks an earlier winner.
select throws_ok($$select public.draw_giveaway_winners(pg_temp.give(), 1)$$, '22023', 'reason_required', 'a redraw says why');
select is((public.draw_giveaway_winners(pg_temp.give(), 1, 'Winner did not reply in 7 days')->>'eligible_count')::integer, 4, 'a redraw leaves out earlier winners');
select ok(not exists(select 1 from public.action_giveaway_draws a, public.action_giveaway_draws b where a.action_id=pg_temp.give() and b.action_id=a.action_id and a.draw_number=1 and b.draw_number=2 and a.winner_submission_ids && b.winner_submission_ids), 'nobody wins twice');

-- Announcing.
select is(public.get_giveaway_announcement(pg_temp.give()), null, 'nothing is public before announcing');
select is((public.announce_giveaway_draw((select id from public.action_giveaway_draws where action_id=pg_temp.give() and draw_number=2), true)->'announced')::boolean, true, 'the owner announces a draw');
reset role;
set local role anon;
select ok((select bool_and(n ~ '^[^ @]+( [A-Z]\.)?$') from jsonb_array_elements_text(public.get_giveaway_announcement(pg_temp.give())->'names') n), 'the public sees first name and initial only');
select is(public.get_giveaway_announcement(pg_temp.give())->>'eligible_count', '4', 'and the draw''s eligible count');
select throws_ok($$select count(*) from public.action_giveaway_draws$$, '42501', null, 'visitors cannot read draws');
reset role;
set local role authenticated;
select pg_temp.as_user('stranger');
select is((select count(*) from public.action_giveaway_draws)::integer, 0, 'another member reads no draws');
reset role;

select * from finish();
rollback;
