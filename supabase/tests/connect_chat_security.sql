begin;
select no_plan();

select is(public.chat_is_enabled(),false,'chat ships disabled at the database boundary');

select ok((select relrowsecurity from pg_class where oid = 'public.chat_messages'::regclass), 'messages have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.chat_conversations'::regclass), 'conversations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'private.chat_reports'::regclass), 'reports have RLS');
select ok(not has_table_privilege('authenticated','public.chat_messages','insert'), 'clients cannot insert messages directly');
select ok(not has_table_privilege('authenticated','public.chat_conversations','update'), 'clients cannot accept by updating a row');
select ok(not has_table_privilege('authenticated','public.chat_blocks','insert'), 'clients cannot bypass block RPC');
select ok(not has_table_privilege('anon','public.chat_messages','select'), 'guests cannot read chat');
select ok(not has_function_privilege('anon','public.chat_start_request(uuid,uuid,text)','execute'), 'guests cannot request');
select ok(not has_function_privilege('authenticated','public.chat_admin_open_report(uuid,uuid)','execute'), 'members cannot open report evidence');
select ok(has_function_privilege('service_role','public.chat_admin_open_report(uuid,uuid)','execute'), 'case review RPC is service-role scoped');
select throws_ok(format('select public.chat_admin_list_reports(%L,30,null,null)',
  '00000000-0000-4000-8000-000000000001'),
  '42501',null,'unprovisioned actor cannot view the report queue');
select ok((select prosecdef and proconfig @> array['search_path=""']
  from pg_proc where oid = 'public.chat_send(uuid,uuid,text)'::regprocedure), 'send has a locked security definer');

insert into auth.users(id,aud,role,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
values
('00000000-0000-4000-8000-000000000001','authenticated','authenticated','chat-a@example.test','{"username":"chat_a","display_name":"Alice"}',now(),now(),now()),
('00000000-0000-4000-8000-000000000002','authenticated','authenticated','chat-b@example.test','{"username":"chat_b","display_name":"Bob"}',now(),now(),now()),
('00000000-0000-4000-8000-000000000003','authenticated','authenticated','chat-c@example.test','{"username":"chat_c","display_name":"Carol"}',now(),now(),now()),
('00000000-0000-4000-8000-000000000004','authenticated','authenticated','chat-d@example.test','{"username":"chat_d","display_name":"Dan"}',now(),now(),now());
insert into public.connections(user_id,connected_user_id,user_display_name_snapshot,connected_display_name_snapshot)
values
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','Alice','Bob'),
('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Alice','Carol'),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','Bob','Carol');

create temporary table chat_test(key text primary key,value text not null);
grant select,insert,update on chat_test to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000000','Closed'),
  '42501',null,'database runtime gate rejects direct RPC calls');
reset role;
update private.chat_runtime set enabled = true,updated_at = now() where singleton;
select is(public.chat_is_enabled(),true,'local test can explicitly enable chat');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into chat_test values('ab',public.chat_start_request(
  '00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Hello Bob') ->> 'conversation_id');
select is((select count(*)::int from public.chat_messages),1,'first request creates one message');
select is(public.chat_start_request('00000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001','Hello Bob') ->> 'conversation_id',
  (select value from chat_test where key='ab'),'identical request retry returns same conversation');
select is((select count(*)::int from public.chat_messages),1,'retry does not duplicate');
select throws_ok(format('select public.chat_hide(%L)',
  (select value from chat_test where key='ab')),
  '42501',null,'pending request cannot be silently hidden');
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Again'),
  '42501',null,'second first message is rejected');
select throws_ok(format('select public.chat_send(%L,%L,%L)',
  (select value from chat_test where key='ab'),'20000000-0000-4000-8000-000000000001','Premature'),
  '42501',null,'sender cannot write before acceptance');
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','Self'),
  '22023',null,'self requests fail');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000040','Hi stranger'),
  '42501','chat_connection_required','an account without a registered Connection cannot request');
select throws_ok(format('select public.chat_block(%L)','00000000-0000-4000-8000-000000000001'),
  '42501',null,'an unrelated account cannot create block rows for arbitrary members');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*)::int from public.chat_messages),0,'unrelated account sees no message');
select is((select count(*)::int from public.chat_conversations),0,'unrelated account sees no conversation');
select throws_ok(format('select public.chat_decide_request(%L,%L)',
  (select value from chat_test where key='ab'),'accept'),
  '42501',null,'third party cannot accept');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*)::int from public.chat_messages),1,'recipient can read request');
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Reciprocal'),
  '42501',null,'reciprocal request does not silently accept');
select is((select status from public.chat_conversations where id=(select value::uuid from chat_test where key='ab')),
  'pending','request remains pending');
select is(public.chat_decide_request((select value::uuid from chat_test where key='ab'),'accept')->>'status',
  'accepted','recipient explicitly accepts');
select is((select unread_count from public.chat_participant_state
  where conversation_id=(select value::uuid from chat_test where key='ab') and user_id=auth.uid()),0,'acceptance clears recipient unread');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok((public.chat_send((select value::uuid from chat_test where key='ab'),
  '20000000-0000-4000-8000-000000000002','After accept')->>'message_id') is not null,'accepted sender can send');
select is((select count(*)::int from public.chat_participant_state where
  conversation_id=(select value::uuid from chat_test where key='ab')
  and user_id='00000000-0000-4000-8000-000000000002'),0,'sender cannot read the recipient unread state');
select ok((public.chat_send((select value::uuid from chat_test where key='ab'),
  '20000000-0000-4000-8000-000000000002','After accept')->>'message_id') is not null,'send retry succeeds');
select is((select count(*)::int from public.chat_messages where conversation_id=(select value::uuid from chat_test where key='ab')),
  2,'send retry creates no duplicate');
select throws_ok(format('select public.chat_send(%L,%L,%L)',
  (select value from chat_test where key='ab'),'20000000-0000-4000-8000-000000000002','Changed text'),
  '22023',null,'retry key cannot change the body');
select ok((select count(*)::int from public.chat_inbox(30,null,null))=1,'sender sees one account-level inbox row');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select unread_count from public.chat_participant_state where
  conversation_id=(select value::uuid from chat_test where key='ab') and user_id=auth.uid()),1,'recipient gains one unread, retry adds none');
select is(public.chat_unread_total(),1,'account unread total counts the incoming message');
select public.chat_mark_read((select value::uuid from chat_test where key='ab'),2);
select is((select unread_count from public.chat_participant_state where
  conversation_id=(select value::uuid from chat_test where key='ab') and user_id=auth.uid()),0,'mark read clears unread');
select is(public.chat_unread_total(),0,'unread total follows mark read');
select public.chat_hide((select value::uuid from chat_test where key='ab'));
select is((select count(*)::int from public.chat_inbox(30,null,null)),0,'hide affects only own inbox');
select public.chat_block('00000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.chat_blocks),1,'blocker can see own block');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from public.chat_blocks),0,'blocked member cannot inspect block table');
select throws_ok(format('select public.chat_send(%L,%L,%L)',
  (select value from chat_test where key='ab'),'20000000-0000-4000-8000-000000000003','Blocked'),
  '42501',null,'block stops further messages');
select throws_ok(format('select public.chat_report(%L,%L,%L)',
  (select value from chat_test where key='ab'),
  (select id from public.chat_messages where sender_id=auth.uid() order by sequence desc limit 1),'spam'),
  '22023',null,'a member cannot report their own message');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into chat_test values('report',public.chat_report((select value::uuid from chat_test where key='ab'),
  (select id from public.chat_messages where sender_id='00000000-0000-4000-8000-000000000001' order by sequence desc limit 1),
  'harassment','Unwanted message')::text);
select ok((select value from chat_test where key='report') is not null,'recipient can report an incoming message');

select public.chat_unblock('00000000-0000-4000-8000-000000000001');
select public.chat_set_requests_enabled(false);
select is((select allow_requests from public.chat_preferences where user_id=auth.uid()),false,'account-level requests can be disabled');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005','Hello Bob'),
  '42501',null,'disabled preferences reject new requests');
insert into chat_test values('ac',public.chat_start_request(
  '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','Hello Alice') ->> 'conversation_id');

select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.chat_decide_request((select value::uuid from chat_test where key='ac'),'decline')->>'status',
  'declined','recipient can decline');
select is((select count(*)::int from public.chat_inbox(30,null,null) where id=(select value::uuid from chat_test where key='ac')),
  0,'declined request leaves recipient inbox');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok(format('select public.chat_start_request(%L,%L,%L)',
  '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','Again'),
  '42501',null,'declined requester cannot re-request');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.chat_start_request('00000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000008','My turn') ->> 'conversation_id',
  (select value from chat_test where key='ac'),'declining recipient may explicitly initiate');

reset role;
update private.chat_runtime set enabled = false,updated_at = now() where singleton;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::int from public.chat_messages),0,'turning the runtime gate off hides existing messages');
select throws_ok(format('select public.chat_send(%L,%L,%L)',
  (select value from chat_test where key='ac'),'20000000-0000-4000-8000-000000000050','Closed'),
  '42501','chat_sign_in_required','turning the runtime gate off stops sends');
reset role;
update private.chat_runtime set enabled = true,updated_at = now() where singleton;
update public.profiles set display_name='Caroline' where id='00000000-0000-4000-8000-000000000003';
select is((select user_high_name from public.chat_conversations where id=(select value::uuid from chat_test where key='ac')),
  'Caroline','display name changes reach existing conversations');
select ok((select count(*) from private.chat_reports where id=(select value::uuid from chat_test where key='report'))=1,
  'report evidence is stored privately');
select ok((select pg_catalog.jsonb_array_length(evidence) <= 5 from private.chat_reports
  where id=(select value::uuid from chat_test where key='report')),'evidence context is bounded');
delete from auth.users where id='00000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.chat_conversations),0,'account deletion removes both participants conversation content');
select is((select count(*)::int from private.chat_reports where id=(select value::uuid from chat_test where key='report')),
  1,'abuse evidence survives account deletion for review');
update private.chat_reports set status='closed',closed_at=now()-interval '91 days',
  retain_until=now()-interval '1 day' where id=(select value::uuid from chat_test where key='report');
select is(public.chat_purge_closed_reports(),1,'closed report is purged after its retention deadline');
select is((select count(*)::int from private.chat_reports where id=(select value::uuid from chat_test where key='report')),
  0,'purged evidence is no longer available');

select * from finish();
rollback;
