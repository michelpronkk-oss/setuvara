begin;

select plan(16);

select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.privacy_requests'::regclass), 'privacy_requests has RLS');
select ok(not has_table_privilege('anon','public.privacy_requests','select'), 'visitors cannot read requests');
select ok(not has_table_privilege('authenticated','public.privacy_requests','insert'), 'members cannot insert requests directly');
select ok(not has_table_privilege('authenticated','public.privacy_requests','update'), 'members cannot change a status');
select ok(not has_table_privilege('authenticated','public.privacy_requests','delete'), 'members cannot delete requests');
select ok(not has_column_privilege('authenticated','public.privacy_requests','subject_hash','select'), 'the subject hash is not readable by members');
select ok(has_column_privilege('authenticated','public.privacy_requests','status','select'), 'members can read a status');
select ok(not has_column_privilege('authenticated','public.social_accounts','provider_scoped_id','update'), 'members cannot set the matching id');

create temporary table pr_people(kind text primary key, user_id uuid not null);
insert into pr_people select kind, gen_random_uuid() from (values('one'),('two')) v(kind);
grant select on pr_people to authenticated;
insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
select user_id,'authenticated','authenticated','pr_'||kind||substr(replace(user_id::text,'-',''),1,8)||'@example.test',
  jsonb_build_object('username','pr_'||substr(replace(user_id::text,'-',''),1,12),'display_name','Privacy '||kind),now(),now(),now() from pr_people;

insert into public.privacy_requests(kind, source, profile_id, confirmation_code)
select 'account_deletion','member',user_id,'AAAAAAAAAAAAAAAAAAA'||case kind when 'one' then '1' else '2' end from pr_people;

select throws_ok($$insert into public.privacy_requests(kind, source, profile_id, confirmation_code) select 'account_deletion','member',user_id,'BBBBBBBBBBBBBBBBBBB1' from pr_people where kind='one'$$, '23505', null, 'only one open account deletion per member');
select throws_ok($$insert into public.privacy_requests(kind, source, provider, confirmation_code) values ('platform_data_deletion','meta_callback','instagram','CCCCCCCCCCCCCCCCCCC1')$$, '23514', null, 'a Meta callback row needs its hash and issued time');
select throws_ok($$insert into public.privacy_requests(kind, source, confirmation_code) values ('account_deletion','meta_callback','DDDDDDDDDDDDDDDDDDD1')$$, '23514', null, 'account deletion only comes from the member');
select throws_ok($$insert into public.privacy_requests(kind, source, profile_id, confirmation_code) values ('platform_deauthorize','member',null,'lowercase-not-ok-0001')$$, '23514', null, 'codes are 20 upper-case characters');

insert into public.privacy_requests(kind, source, provider, subject_hash, signal_issued_at, confirmation_code)
values ('platform_data_deletion','meta_callback','instagram',repeat('a',64),'2026-10-20 18:00:00+00','EEEEEEEEEEEEEEEEEEE1');
select throws_ok($$insert into public.privacy_requests(kind, source, provider, subject_hash, signal_issued_at, confirmation_code) values ('platform_data_deletion','meta_callback','instagram',repeat('a',64),'2026-10-20 18:00:00+00','EEEEEEEEEEEEEEEEEEE2')$$, '23505', null, 'one row per Meta signal');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',(select user_id from pr_people where kind='one'),'role','authenticated')::text, true);
select is((select count(*)::int from public.privacy_requests), 1, 'a member sees only their own requests');
select is((select confirmation_code from public.privacy_requests), 'AAAAAAAAAAAAAAAAAAA1', 'and it is theirs');
reset role;

delete from auth.users where id=(select user_id from pr_people where kind='one');
select is((select profile_id from public.privacy_requests where confirmation_code='AAAAAAAAAAAAAAAAAAA1'), null, 'deleting the account keeps the request record without the member link');

select * from finish();
rollback;
