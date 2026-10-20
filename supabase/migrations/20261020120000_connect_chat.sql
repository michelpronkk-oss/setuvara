-- Connect Chat: account-level, one-to-one conversations. A Connection permits a
-- request; only the recipient's explicit acceptance permits ordinary messages.
-- Chat rows intentionally do not reference connections: deleting an encounter
-- cannot silently erase a conversation. Deleting either account removes it.

create table public.chat_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allow_requests boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  user_low_name text not null check (char_length(user_low_name) between 1 and 80),
  user_high_name text not null check (char_length(user_high_name) between 1 and 80),
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_message_body text,
  last_message_sender_id uuid references auth.users(id) on delete cascade,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_pair_order check (user_low_id < user_high_id),
  constraint chat_requester_participant check (requester_id in (user_low_id,user_high_id)),
  constraint chat_pair_unique unique (user_low_id,user_high_id)
);

create index chat_conversations_activity_idx on public.chat_conversations (last_activity_at desc,id desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  sender_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_request boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chat_message_order_unique unique (conversation_id,sequence),
  constraint chat_message_retry_unique unique (sender_id,client_id)
);

create index chat_messages_history_idx on public.chat_messages (conversation_id,sequence desc);
create index chat_messages_sender_rate_idx on public.chat_messages (sender_id,created_at desc);

create table public.chat_participant_state (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_read_sequence bigint not null default 0 check (last_read_sequence >= 0),
  hidden_through_sequence bigint not null default 0 check (hidden_through_sequence >= 0),
  updated_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);

create index chat_participant_state_user_idx on public.chat_participant_state (user_id,conversation_id);

create table public.chat_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id,blocked_id),
  constraint chat_block_not_self check (blocker_id <> blocked_id)
);

create index chat_blocks_blocked_idx on public.chat_blocks (blocked_id,blocker_id);

-- Reports are not in the Data API. A report captures only the selected message
-- and bounded adjacent context; it can outlive account deletion until reviewed.
create table private.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reported_id uuid not null,
  conversation_id uuid,
  message_id uuid,
  reason text not null check (reason in ('harassment','spam','threat','impersonation','other')),
  details text check (details is null or char_length(details) <= 1000),
  evidence jsonb not null check (pg_catalog.octet_length(evidence::text) <= 16000),
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  retain_until timestamptz
);

create index chat_reports_queue_idx on private.chat_reports (status,created_at desc);
create index chat_reports_recent_idx on private.chat_reports (created_at desc,id desc);
create index chat_reports_reporter_rate_idx on private.chat_reports (reporter_id,created_at desc);
create index chat_reports_retention_idx on private.chat_reports (retain_until) where retain_until is not null;

-- Membership is separately provisioned. Existing general admin access does not
-- grant access to message evidence.
create table private.chat_report_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

-- Migration is safe to deploy before launch. Only a reviewed SQL operation can
-- enable client reads and writes; an application flag alone cannot bypass it.
create table private.chat_runtime (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.chat_runtime(singleton,enabled) values(true,false);

create or replace function public.chat_is_enabled()
returns boolean language sql stable security definer set search_path = '' as $fn$
  select coalesce((select enabled from private.chat_runtime where singleton),false);
$fn$;

alter table public.chat_preferences enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_participant_state enable row level security;
alter table public.chat_blocks enable row level security;
alter table private.chat_reports enable row level security;
alter table private.chat_report_reviewers enable row level security;
alter table private.chat_runtime enable row level security;

revoke all on public.chat_preferences,public.chat_conversations,public.chat_messages,
  public.chat_participant_state,public.chat_blocks from public,anon,authenticated;
revoke all on private.chat_reports,private.chat_report_reviewers from public,anon,authenticated;
revoke all on private.chat_runtime from public,anon,authenticated,service_role;
grant select on public.chat_preferences,public.chat_conversations,public.chat_messages,
  public.chat_participant_state,public.chat_blocks to authenticated;
grant select on public.chat_preferences,public.chat_conversations,public.chat_messages,
  public.chat_participant_state,public.chat_blocks to service_role;

create policy chat_preferences_owner on public.chat_preferences for select to authenticated
  using ((select public.chat_is_enabled()) and user_id = (select auth.uid()));
create policy chat_conversations_participants on public.chat_conversations for select to authenticated
  using ((select public.chat_is_enabled()) and (select auth.uid()) in (user_low_id,user_high_id));
create policy chat_messages_participants on public.chat_messages for select to authenticated
  using ((select public.chat_is_enabled()) and exists (select 1 from public.chat_conversations c where c.id = conversation_id
    and (select auth.uid()) in (c.user_low_id,c.user_high_id)));
create policy chat_state_owner on public.chat_participant_state for select to authenticated
  using ((select public.chat_is_enabled()) and user_id = (select auth.uid()));
create policy chat_blocks_owner on public.chat_blocks for select to authenticated
  using ((select public.chat_is_enabled()) and blocker_id = (select auth.uid()));

revoke all on function public.chat_is_enabled() from public,anon,authenticated;
grant execute on function public.chat_is_enabled() to authenticated,service_role;

create or replace function private.chat_actor()
returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := auth.uid();
begin
  if not public.chat_is_enabled() or v_actor is null or not exists (
    select 1 from auth.users u where u.id = v_actor and u.deleted_at is null
      and (u.banned_until is null or u.banned_until < pg_catalog.statement_timestamp())
  ) then
    raise exception using errcode = '42501',message = 'chat_sign_in_required';
  end if;
  return v_actor;
end;
$fn$;

create or replace function private.chat_require_connection(p_a uuid,p_b uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform 1 from public.connections c
  where (c.user_id = p_a and c.connected_user_id = p_b)
     or (c.user_id = p_b and c.connected_user_id = p_a);
  if not found then raise exception using errcode = '42501',message = 'chat_connection_required'; end if;
end;
$fn$;

create or replace function private.chat_require_unblocked(p_a uuid,p_b uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if exists (select 1 from public.chat_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b)
       or (b.blocker_id = p_b and b.blocked_id = p_a)) then
    raise exception using errcode = '42501',message = 'chat_unavailable';
  end if;
end;
$fn$;

-- Serialize sends, requests and blocks for one pair. The unique pair index
-- remains the final backstop; hash collisions only serialize unrelated pairs.
create or replace function private.chat_lock_pair(p_a uuid,p_b uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(p_a,p_b)::text || ':' || greatest(p_a,p_b)::text,0));
end;
$fn$;

-- Serialize each sender's rate checks across different recipients as well.
create or replace function private.chat_lock_actor(p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-actor:' || p_actor::text,0));
end;
$fn$;

create or replace function private.chat_record_message(
  p_conversation public.chat_conversations,p_actor uuid,p_client_id uuid,p_body text,p_request boolean
) returns public.chat_messages language plpgsql security definer set search_path = '' as $fn$
declare v_message public.chat_messages; v_sequence bigint;
begin
  update public.chat_conversations c set last_sequence = c.last_sequence + 1,
    last_message_body = p_body,last_message_sender_id = p_actor,
    last_activity_at = pg_catalog.statement_timestamp(),updated_at = pg_catalog.statement_timestamp()
  where c.id = p_conversation.id returning c.last_sequence into v_sequence;
  insert into public.chat_messages(conversation_id,sequence,sender_id,client_id,body,is_request)
    values(p_conversation.id,v_sequence,p_actor,p_client_id,p_body,p_request) returning * into v_message;
  update public.chat_participant_state s set
    unread_count = case when s.user_id = p_actor then s.unread_count else s.unread_count + 1 end,
    updated_at = pg_catalog.statement_timestamp()
  where s.conversation_id = p_conversation.id;
  return v_message;
end;
$fn$;

create or replace function public.chat_start_request(p_target_id uuid,p_client_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor(); v_low uuid; v_high uuid;
  v_low_name text; v_high_name text; v_body text := pg_catalog.btrim(p_body);
  v_conversation public.chat_conversations; v_message public.chat_messages;
  v_existing public.chat_messages;
begin
  if p_target_id is null or p_target_id = v_actor or p_client_id is null
    or v_body is null or pg_catalog.char_length(v_body) not between 1 and 2000 then
    raise exception using errcode = '22023',message = 'chat_invalid_request';
  end if;
  v_low := least(v_actor,p_target_id); v_high := greatest(v_actor,p_target_id);
  perform private.chat_lock_actor(v_actor);
  perform private.chat_lock_pair(v_actor,p_target_id);
  select m.* into v_existing from public.chat_messages m where m.sender_id = v_actor and m.client_id = p_client_id;
  if found then
    if v_existing.body <> v_body or not exists (
      select 1 from public.chat_conversations c where c.id = v_existing.conversation_id
        and c.user_low_id = v_low and c.user_high_id = v_high
    ) then raise exception using errcode = '22023',message = 'chat_retry_mismatch'; end if;
    return pg_catalog.jsonb_build_object('conversation_id',v_existing.conversation_id,'message_id',v_existing.id);
  end if;
  perform private.chat_require_connection(v_actor,p_target_id);
  perform private.chat_require_unblocked(v_actor,p_target_id);
  if exists (select 1 from public.chat_preferences p where p.user_id = p_target_id and not p.allow_requests) then
    raise exception using errcode = '42501',message = 'chat_unavailable';
  end if;
  if (select count(*) from public.chat_messages m where m.sender_id = v_actor and m.is_request
    and m.created_at > pg_catalog.statement_timestamp() - interval '24 hours') >= 20 then
    raise exception using errcode = '42501',message = 'chat_rate_limited';
  end if;
  select pg_catalog.left(pg_catalog.btrim(p.display_name),80) into v_low_name from public.profiles p where p.id = v_low;
  select pg_catalog.left(pg_catalog.btrim(p.display_name),80) into v_high_name from public.profiles p where p.id = v_high;
  if v_low_name is null or v_high_name is null then
    raise exception using errcode = '42501',message = 'chat_unavailable';
  end if;
  insert into public.chat_conversations(user_low_id,user_high_id,user_low_name,user_high_name,requester_id)
    values(v_low,v_high,v_low_name,v_high_name,v_actor) on conflict (user_low_id,user_high_id) do nothing;
  select * into v_conversation from public.chat_conversations c
    where c.user_low_id = v_low and c.user_high_id = v_high for update;
  if v_conversation.status = 'accepted' then
    raise exception using errcode = '22023',message = 'chat_already_open';
  end if;
  if v_conversation.status = 'pending' and v_conversation.last_sequence > 0 then
    raise exception using errcode = '42501',message = 'chat_request_pending';
  end if;
  if v_conversation.status = 'declined' then
    if v_conversation.requester_id = v_actor then
      raise exception using errcode = '42501',message = 'chat_request_declined';
    end if;
    update public.chat_conversations set status = 'pending',requester_id = v_actor,
      updated_at = pg_catalog.statement_timestamp() where id = v_conversation.id;
  end if;
  insert into public.chat_participant_state(conversation_id,user_id)
    values(v_conversation.id,v_low),(v_conversation.id,v_high) on conflict do nothing;
  v_message := private.chat_record_message(v_conversation,v_actor,p_client_id,v_body,true);
  return pg_catalog.jsonb_build_object('conversation_id',v_conversation.id,'message_id',v_message.id);
end;
$fn$;

create or replace function public.chat_send(p_conversation_id uuid,p_client_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor(); v_body text := pg_catalog.btrim(p_body);
  v_conversation public.chat_conversations; v_other uuid; v_message public.chat_messages;
begin
  if p_conversation_id is null or p_client_id is null or v_body is null
    or pg_catalog.char_length(v_body) not between 1 and 2000 then
    raise exception using errcode = '22023',message = 'chat_invalid_message';
  end if;
  select * into v_message from public.chat_messages m where m.sender_id = v_actor and m.client_id = p_client_id;
  if found then
    if v_message.conversation_id <> p_conversation_id or v_message.body <> v_body then
      raise exception using errcode = '22023',message = 'chat_retry_mismatch'; end if;
    return pg_catalog.jsonb_build_object('conversation_id',p_conversation_id,'message_id',v_message.id,'sequence',v_message.sequence);
  end if;
  select * into v_conversation from public.chat_conversations c where c.id = p_conversation_id;
  if not found or v_actor not in (v_conversation.user_low_id,v_conversation.user_high_id) then
    raise exception using errcode = '42501',message = 'chat_unavailable';
  end if;
  if v_conversation.status <> 'accepted' then
    raise exception using errcode = '42501',message = 'chat_acceptance_required';
  end if;
  v_other := case when v_actor = v_conversation.user_low_id then v_conversation.user_high_id else v_conversation.user_low_id end;
  perform private.chat_lock_actor(v_actor);
  perform private.chat_lock_pair(v_actor,v_other);
  select * into v_message from public.chat_messages m where m.sender_id = v_actor and m.client_id = p_client_id;
  if found then
    if v_message.conversation_id <> p_conversation_id or v_message.body <> v_body then
      raise exception using errcode = '22023',message = 'chat_retry_mismatch'; end if;
    return pg_catalog.jsonb_build_object('conversation_id',p_conversation_id,'message_id',v_message.id,'sequence',v_message.sequence);
  end if;
  select * into v_conversation from public.chat_conversations c where c.id = p_conversation_id for update;
  if v_conversation.status <> 'accepted' then
    raise exception using errcode = '42501',message = 'chat_acceptance_required'; end if;
  perform private.chat_require_unblocked(v_actor,v_other);
  if (select count(*) from public.chat_messages m where m.sender_id = v_actor
    and m.created_at > pg_catalog.statement_timestamp() - interval '1 minute') >= 30 then
    raise exception using errcode = '42501',message = 'chat_rate_limited';
  end if;
  v_message := private.chat_record_message(v_conversation,v_actor,p_client_id,v_body,false);
  return pg_catalog.jsonb_build_object('conversation_id',p_conversation_id,'message_id',v_message.id,'sequence',v_message.sequence);
end;
$fn$;

create or replace function public.chat_decide_request(p_conversation_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor(); v_conversation public.chat_conversations; v_other uuid;
begin
  if p_action is null or p_action not in ('accept','decline') then
    raise exception using errcode = '22023',message = 'chat_invalid_action'; end if;
  select * into v_conversation from public.chat_conversations where id = p_conversation_id;
  if not found or v_actor not in (v_conversation.user_low_id,v_conversation.user_high_id)
    or v_actor = v_conversation.requester_id then
    raise exception using errcode = '42501',message = 'chat_unavailable'; end if;
  if v_conversation.status = (case when p_action = 'accept' then 'accepted' else 'declined' end) then
    return pg_catalog.jsonb_build_object('status',v_conversation.status);
  end if;
  if v_conversation.status <> 'pending' then raise exception using errcode = '42501',message = 'chat_request_not_pending'; end if;
  v_other := v_conversation.requester_id;
  perform private.chat_lock_pair(v_actor,v_other);
  select * into v_conversation from public.chat_conversations where id = p_conversation_id for update;
  if v_conversation.status <> 'pending' or v_conversation.requester_id = v_actor then
    raise exception using errcode = '42501',message = 'chat_request_not_pending'; end if;
  perform private.chat_require_unblocked(v_actor,v_other);
  if p_action = 'accept' then perform private.chat_require_connection(v_actor,v_other); end if;
  update public.chat_conversations set status = case when p_action = 'accept' then 'accepted' else 'declined' end,
    updated_at = pg_catalog.statement_timestamp(),last_activity_at = pg_catalog.statement_timestamp()
    where id = p_conversation_id;
  update public.chat_participant_state set unread_count = 0,last_read_sequence = v_conversation.last_sequence,
    hidden_through_sequence = case when p_action = 'decline' then v_conversation.last_sequence else hidden_through_sequence end,
    updated_at = pg_catalog.statement_timestamp() where conversation_id = p_conversation_id and user_id = v_actor;
  return pg_catalog.jsonb_build_object('status',case when p_action = 'accept' then 'accepted' else 'declined' end);
end;
$fn$;

create or replace function public.chat_set_requests_enabled(p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor();
begin
  if p_enabled is null then raise exception using errcode = '22023',message = 'chat_invalid_preference'; end if;
  insert into public.chat_preferences(user_id,allow_requests) values(v_actor,p_enabled)
    on conflict(user_id) do update set allow_requests = excluded.allow_requests,updated_at = pg_catalog.statement_timestamp();
end;
$fn$;

create or replace function public.chat_mark_read(p_conversation_id uuid,p_through_sequence bigint)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor(); v_conversation public.chat_conversations;
begin
  select * into v_conversation from public.chat_conversations where id = p_conversation_id;
  if not found or v_actor not in (v_conversation.user_low_id,v_conversation.user_high_id)
    or p_through_sequence is null or p_through_sequence < 0 then
    raise exception using errcode = '42501',message = 'chat_unavailable'; end if;
  update public.chat_participant_state s set
    last_read_sequence = greatest(s.last_read_sequence,least(p_through_sequence,v_conversation.last_sequence)),
    unread_count = (select count(*) from public.chat_messages m where m.conversation_id = p_conversation_id
      and m.sequence > greatest(s.last_read_sequence,least(p_through_sequence,v_conversation.last_sequence))
      and m.sender_id <> v_actor),
    updated_at = pg_catalog.statement_timestamp()
  where s.conversation_id = p_conversation_id and s.user_id = v_actor;
end;
$fn$;

create or replace function public.chat_hide(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor(); v_conversation public.chat_conversations;
begin
  select * into v_conversation from public.chat_conversations where id = p_conversation_id;
  if not found or v_actor not in (v_conversation.user_low_id,v_conversation.user_high_id) then
    raise exception using errcode = '42501',message = 'chat_unavailable'; end if;
  if v_conversation.status = 'pending' then
    raise exception using errcode = '42501',message = 'chat_request_not_pending'; end if;
  update public.chat_participant_state set hidden_through_sequence = v_conversation.last_sequence,
    unread_count = 0,last_read_sequence = v_conversation.last_sequence,updated_at = pg_catalog.statement_timestamp()
  where conversation_id = p_conversation_id and user_id = v_actor;
end;
$fn$;

create or replace function public.chat_block(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor();
begin
  if p_user_id is null or p_user_id = v_actor then raise exception using errcode = '22023',message = 'chat_invalid_user'; end if;
  if not exists (select 1 from public.connections c
      where (c.user_id = v_actor and c.connected_user_id = p_user_id)
         or (c.user_id = p_user_id and c.connected_user_id = v_actor))
    and not exists (select 1 from public.chat_conversations c
      where c.user_low_id = least(v_actor,p_user_id)
        and c.user_high_id = greatest(v_actor,p_user_id)) then
    raise exception using errcode = '42501',message = 'chat_unavailable';
  end if;
  perform private.chat_lock_pair(v_actor,p_user_id);
  insert into public.chat_blocks(blocker_id,blocked_id) values(v_actor,p_user_id) on conflict do nothing;
end;
$fn$;

create or replace function public.chat_unblock(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor();
begin
  delete from public.chat_blocks where blocker_id = v_actor and blocked_id = p_user_id;
end;
$fn$;

create or replace function public.chat_report(
  p_conversation_id uuid,p_message_id uuid,p_reason text,p_details text default null
) returns uuid language plpgsql security definer set search_path = '' as $fn$
declare v_actor uuid := private.chat_actor(); v_conversation public.chat_conversations;
  v_message public.chat_messages; v_other uuid; v_evidence jsonb; v_report_id uuid;
begin
  if p_reason is null or p_reason not in ('harassment','spam','threat','impersonation','other')
    or pg_catalog.char_length(coalesce(p_details,'')) > 1000 then
    raise exception using errcode = '22023',message = 'chat_invalid_report'; end if;
  select * into v_conversation from public.chat_conversations where id = p_conversation_id;
  if not found or v_actor not in (v_conversation.user_low_id,v_conversation.user_high_id) then
    raise exception using errcode = '42501',message = 'chat_unavailable'; end if;
  select * into v_message from public.chat_messages where id = p_message_id and conversation_id = p_conversation_id;
  if not found then raise exception using errcode = '22023',message = 'chat_message_not_found'; end if;
  perform private.chat_lock_actor(v_actor);
  if (select count(*) from private.chat_reports where reporter_id = v_actor
    and created_at > pg_catalog.statement_timestamp() - interval '24 hours') >= 5 then
    raise exception using errcode = '42501',message = 'chat_rate_limited'; end if;
  v_other := case when v_actor = v_conversation.user_low_id then v_conversation.user_high_id else v_conversation.user_low_id end;
  if v_message.sender_id <> v_other then raise exception using errcode = '22023',message = 'chat_invalid_report'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'message_id',m.id,'sequence',m.sequence,'sender_id',m.sender_id,
    'body',case when m.id = p_message_id then m.body else pg_catalog.left(m.body,200) end,
    'created_at',m.created_at
  ) order by m.sequence),'[]'::jsonb) into v_evidence
  from public.chat_messages m where m.conversation_id = p_conversation_id
    and m.sequence between greatest(1,v_message.sequence - 1) and v_message.sequence + 1;
  insert into private.chat_reports(reporter_id,reported_id,conversation_id,message_id,reason,details,evidence)
    values(v_actor,v_other,p_conversation_id,p_message_id,p_reason,nullif(pg_catalog.btrim(p_details),''),v_evidence)
    returning id into v_report_id;
  return v_report_id;
end;
$fn$;

-- Keyset inbox pagination. RLS still applies because this is an invoker function.
create or replace function public.chat_inbox(p_limit integer default 30,p_before_at timestamptz default null,p_before_id uuid default null)
returns table(
  id uuid,other_user_id uuid,other_name text,requester_id uuid,status text,
  last_sequence bigint,last_message_body text,last_message_sender_id uuid,last_activity_at timestamptz,
  unread_count integer
) language sql stable security invoker set search_path = '' as $fn$
  select c.id,
    case when c.user_low_id = auth.uid() then c.user_high_id else c.user_low_id end,
    case when c.user_low_id = auth.uid() then c.user_high_name else c.user_low_name end,
    c.requester_id,c.status,c.last_sequence,c.last_message_body,c.last_message_sender_id,c.last_activity_at,s.unread_count
  from public.chat_conversations c
  join public.chat_participant_state s on s.conversation_id = c.id and s.user_id = auth.uid()
  where auth.uid() in (c.user_low_id,c.user_high_id)
    and (s.hidden_through_sequence = 0 or c.last_sequence > s.hidden_through_sequence)
    and (p_before_at is null or c.last_activity_at < p_before_at
      or (c.last_activity_at = p_before_at and c.id < p_before_id))
  order by c.last_activity_at desc,c.id desc
  limit least(greatest(coalesce(p_limit,30),1),50);
$fn$;

-- A reviewer must be both an MFA-gated Setuvara admin in the application and
-- explicitly allowlisted here. This helper is called only by service-role RPCs.
create or replace function private.chat_require_reviewer(p_actor uuid)
returns text language plpgsql security definer set search_path = '' as $fn$
declare v_role text;
begin
  v_role := private.admin_require_actor(p_actor,array['owner','admin']);
  if not exists (select 1 from private.chat_report_reviewers where user_id = p_actor) then
    raise exception using errcode = '42501',message = 'chat_review_not_allowed'; end if;
  return v_role;
end;
$fn$;

create or replace function public.chat_admin_list_reports(
  p_actor uuid,p_limit integer default 30,p_before_at timestamptz default null,p_before_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_rows jsonb;
begin
  perform private.chat_require_reviewer(p_actor);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',r.id,'reason',r.reason,'status',r.status,'created_at',r.created_at,
    'reporter_id',r.reporter_id,'reported_id',r.reported_id
  ) order by r.created_at desc,r.id desc),'[]'::jsonb) into v_rows
  from (select * from private.chat_reports
    where p_before_at is null or created_at < p_before_at
      or (created_at = p_before_at and id < p_before_id)
    order by created_at desc,id desc limit least(greatest(coalesce(p_limit,30),1),50)) r;
  return v_rows;
end;
$fn$;

create or replace function public.chat_admin_open_report(p_actor uuid,p_report_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare v_role text; v_report private.chat_reports;
begin
  v_role := private.chat_require_reviewer(p_actor);
  select * into v_report from private.chat_reports where id = p_report_id;
  if not found then raise exception using errcode = 'P0002',message = 'chat_report_not_found'; end if;
  insert into private.admin_audit_log(actor_user_id,actor_role,action,target_type,target_id)
    values(p_actor,v_role,'chat_report.opened','chat_report',p_report_id::text);
  return pg_catalog.jsonb_build_object('id',v_report.id,'reason',v_report.reason,
    'details',v_report.details,'status',v_report.status,'created_at',v_report.created_at,
    'reporter_id',v_report.reporter_id,'reported_id',v_report.reported_id,
    'evidence',v_report.evidence);
end;
$fn$;

create or replace function public.chat_admin_set_report_status(p_actor uuid,p_report_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $fn$
declare v_role text; v_old text;
begin
  if p_status is null or p_status not in ('open','reviewing','closed') then
    raise exception using errcode = '22023',message = 'chat_invalid_status'; end if;
  v_role := private.chat_require_reviewer(p_actor);
  select status into v_old from private.chat_reports where id = p_report_id for update;
  if not found then raise exception using errcode = 'P0002',message = 'chat_report_not_found'; end if;
  update private.chat_reports set status = p_status,
    closed_at = case when p_status = 'closed' then pg_catalog.statement_timestamp() else null end,
    retain_until = case when p_status = 'closed' then pg_catalog.statement_timestamp() + interval '90 days' else null end
    where id = p_report_id;
  insert into private.admin_audit_log(actor_user_id,actor_role,action,target_type,target_id,before,after)
    values(p_actor,v_role,'chat_report.status_changed','chat_report',p_report_id::text,
      pg_catalog.jsonb_build_object('status',v_old),pg_catalog.jsonb_build_object('status',p_status));
end;
$fn$;

-- Run from a reviewed Setuvara maintenance job after the privacy notice is approved.
create or replace function public.chat_purge_closed_reports()
returns integer language plpgsql security definer set search_path = '' as $fn$
declare v_count integer;
begin
  delete from private.chat_reports where status = 'closed' and retain_until < pg_catalog.statement_timestamp();
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

revoke all on function private.chat_actor(),private.chat_require_connection(uuid,uuid),
  private.chat_require_unblocked(uuid,uuid),private.chat_lock_pair(uuid,uuid),private.chat_lock_actor(uuid),
  private.chat_record_message(public.chat_conversations,uuid,uuid,text,boolean),
  private.chat_require_reviewer(uuid) from public,anon,authenticated;
revoke all on function public.chat_start_request(uuid,uuid,text),public.chat_send(uuid,uuid,text),
  public.chat_decide_request(uuid,text),public.chat_set_requests_enabled(boolean),
  public.chat_mark_read(uuid,bigint),public.chat_hide(uuid),public.chat_block(uuid),
  public.chat_unblock(uuid),public.chat_report(uuid,uuid,text,text),
  public.chat_inbox(integer,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.chat_start_request(uuid,uuid,text),public.chat_send(uuid,uuid,text),
  public.chat_decide_request(uuid,text),public.chat_set_requests_enabled(boolean),
  public.chat_mark_read(uuid,bigint),public.chat_hide(uuid),public.chat_block(uuid),
  public.chat_unblock(uuid),public.chat_report(uuid,uuid,text,text),
  public.chat_inbox(integer,timestamptz,uuid) to authenticated;
revoke all on function public.chat_admin_list_reports(uuid,integer,timestamptz,uuid),
  public.chat_admin_open_report(uuid,uuid),public.chat_admin_set_report_status(uuid,uuid,text),
  public.chat_purge_closed_reports() from public,anon,authenticated;
grant execute on function public.chat_admin_list_reports(uuid,integer,timestamptz,uuid),
  public.chat_admin_open_report(uuid,uuid),public.chat_admin_set_report_status(uuid,uuid,text),
  public.chat_purge_closed_reports() to service_role;

alter publication supabase_realtime add table public.chat_conversations;
