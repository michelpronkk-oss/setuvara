-- Creator Mode 2.0, slice 1: the brand deal pipeline.
--
-- A deal is one collaboration request: a response to a Collab Action on Creator Mode
-- (action_submissions, kind 'collab'; direct inquiries moved into Actions in 20261020140000).
-- Every one becomes a deal, now and from now on. The creator moves a deal
-- New → Talking → Booked → Completed → Paid, or Declined, keeps notes (Plus) and can record the
-- fee they agreed. Every money figure is the creator's own entry, labelled as such; Setuvara never
-- infers a fee from a stated budget band, and Paid is the creator's mark, not a payment record.

create table public.creator_deals (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid references public.action_submissions(id) on delete set null,
  sender_user_id uuid references public.profiles(id) on delete set null,
  brand text not null default '' check (char_length(brand) <= 120),
  contact_name text not null default '' check (char_length(contact_name) <= 80),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  collab_type text check (collab_type is null or char_length(collab_type) <= 40),
  stated_budget text check (stated_budget is null or char_length(stated_budget) <= 40),
  stage text not null default 'new' check (stage in ('new','talking','booked','completed','paid','declined')),
  declined_reason text check (declined_reason is null or char_length(declined_reason) <= 200),
  agreed_amount_cents bigint check (agreed_amount_cents is null or agreed_amount_cents between 0 and 100000000000),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  stage_changed_at timestamptz not null default pg_catalog.statement_timestamp(),
  last_activity_at timestamptz not null default pg_catalog.statement_timestamp(),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check ((agreed_amount_cents is null) = (currency is null)),
  check (stage = 'declined' or declined_reason is null)
);
create index creator_deals_owner_idx on public.creator_deals (creator_user_id, last_activity_at desc);
create index creator_deals_stage_idx on public.creator_deals (creator_user_id, stage);
create unique index creator_deals_submission_uidx on public.creator_deals (submission_id) where submission_id is not null;
create index creator_deals_sender_idx on public.creator_deals (sender_user_id) where sender_user_id is not null;
create trigger creator_deals_set_updated_at before update on public.creator_deals
  for each row execute function private.set_updated_at();

create table public.creator_deal_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.creator_deals(id) on delete cascade,
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('created','stage','note','amount')),
  from_stage text check (from_stage is null or from_stage in ('new','talking','booked','completed','paid','declined')),
  to_stage text check (to_stage is null or to_stage in ('new','talking','booked','completed','paid','declined')),
  body text check (body is null or char_length(body) between 1 and 2000),
  amount_cents bigint,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  idempotency_key text check (idempotency_key is null or idempotency_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (kind <> 'stage' or (from_stage is not null and to_stage is not null)),
  check (kind <> 'note' or body is not null),
  unique (deal_id, idempotency_key)
);
create index creator_deal_activities_deal_idx on public.creator_deal_activities (deal_id, created_at desc);
create index creator_deal_activities_owner_idx on public.creator_deal_activities (creator_user_id);

alter table public.creator_deals enable row level security;
alter table public.creator_deal_activities enable row level security;
revoke all on public.creator_deals, public.creator_deal_activities from public, anon, authenticated;
grant select on public.creator_deals, public.creator_deal_activities to authenticated;
grant all on public.creator_deals, public.creator_deal_activities to service_role;
create policy creator_deals_owner_read on public.creator_deals for select to authenticated
  using (creator_user_id = (select auth.uid()));
create policy creator_deal_activities_owner_read on public.creator_deal_activities for select to authenticated
  using (creator_user_id = (select auth.uid()));

-- A Collab Action response on Creator Mode becomes a deal (once, and not while it is spam).
create function private.deal_from_submission(s public.action_submissions)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_id uuid;
begin
  if s.kind <> 'collab' or s.status in ('spam','pending_verification') then return null; end if;
  if not exists(select 1 from public.profile_actions a join public.profile_modes m on m.id = a.mode_id
      where a.id = s.action_id and m.slug = 'creator') then return null; end if;
  select d.id into v_id from public.creator_deals d where d.submission_id = s.id;
  if v_id is not null then return v_id; end if;
  insert into public.creator_deals (creator_user_id, submission_id, sender_user_id, brand, contact_name, contact_email,
      collab_type, stated_budget, stage_changed_at, last_activity_at, created_at)
    values (s.profile_id, s.id, s.submitter_user_id, pg_catalog.left(coalesce(s.answers->>'company', ''), 120), s.name, s.email,
      nullif(s.answers->>'collabType', ''), nullif(s.answers->>'budget', ''), s.created_at, s.created_at, s.created_at)
    on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into public.creator_deal_activities (deal_id, creator_user_id, kind, created_at) values (v_id, s.profile_id, 'created', s.created_at);
  end if;
  return v_id;
end;
$function$;

create function private.on_submission_deal() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if tg_op = 'INSERT' or (old.status = 'spam' and new.status <> 'spam') then
    perform private.deal_from_submission(new);
  elsif new.status = 'spam' and old.status <> 'spam' then
    delete from public.creator_deals d where d.submission_id = new.id and d.stage = 'new'
      and not exists(select 1 from public.creator_deal_activities x where x.deal_id = d.id and x.kind <> 'created');
  end if;
  return null;
end;
$function$;
create trigger action_submissions_creator_deal after insert or update of status on public.action_submissions
  for each row execute function private.on_submission_deal();

-- The creator's moves.
create function public.set_creator_deal_stage(p_deal_id uuid, p_stage text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  d public.creator_deals;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_stage is null or p_stage not in ('new','talking','booked','completed','paid','declined') then raise exception using errcode='22023', message='invalid_stage'; end if;
  if v_reason is not null and (p_stage <> 'declined' or pg_catalog.char_length(v_reason) > 200) then raise exception using errcode='22023', message='invalid_reason'; end if;
  select * into d from public.creator_deals where id = p_deal_id and creator_user_id = auth.uid() for update;
  if not found then raise exception using errcode='P0002', message='deal_not_found'; end if;
  if d.stage = p_stage and d.declined_reason is not distinct from v_reason then return jsonb_build_object('id', d.id, 'stage', d.stage, 'changed', false); end if;
  update public.creator_deals set stage = p_stage, declined_reason = v_reason, stage_changed_at = pg_catalog.statement_timestamp(),
    last_activity_at = pg_catalog.statement_timestamp() where id = d.id;
  if d.stage <> p_stage then
    insert into public.creator_deal_activities (deal_id, creator_user_id, kind, from_stage, to_stage) values (d.id, d.creator_user_id, 'stage', d.stage, p_stage);
  end if;
  return jsonb_build_object('id', d.id, 'stage', p_stage, 'changed', true);
end;
$function$;

-- The fee the creator agreed, in their own words and currency. Null clears it.
create function public.set_creator_deal_amount(p_deal_id uuid, p_amount_cents bigint, p_currency text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  d public.creator_deals;
  v_currency text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_currency, ''))), '');
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if (p_amount_cents is null) <> (v_currency is null) or (p_amount_cents is not null and (p_amount_cents not between 0 and 100000000000 or v_currency !~ '^[A-Z]{3}$')) then
    raise exception using errcode='22023', message='invalid_amount';
  end if;
  select * into d from public.creator_deals where id = p_deal_id and creator_user_id = auth.uid() for update;
  if not found then raise exception using errcode='P0002', message='deal_not_found'; end if;
  if d.agreed_amount_cents is not distinct from p_amount_cents and d.currency is not distinct from v_currency then return jsonb_build_object('changed', false); end if;
  update public.creator_deals set agreed_amount_cents = p_amount_cents, currency = v_currency, last_activity_at = pg_catalog.statement_timestamp() where id = d.id;
  insert into public.creator_deal_activities (deal_id, creator_user_id, kind, amount_cents, currency) values (d.id, d.creator_user_id, 'amount', p_amount_cents, v_currency);
  return jsonb_build_object('changed', true);
end;
$function$;

-- Notes are Plus, like Business leads.
create function public.add_creator_deal_note(p_deal_id uuid, p_body text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare
  d public.creator_deals;
  v_body text := pg_catalog.btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if pg_catalog.char_length(v_body) not between 1 and 2000 then raise exception using errcode='22023', message='invalid_note'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,64}$' then raise exception using errcode='22023', message='invalid_request'; end if;
  select * into d from public.creator_deals where id = p_deal_id and creator_user_id = auth.uid() for update;
  if not found then raise exception using errcode='P0002', message='deal_not_found'; end if;
  if private.member_plan(d.creator_user_id) = 'free' then raise exception using errcode='P0001', message='notes_require_plus'; end if;
  select x.id into v_id from public.creator_deal_activities x where x.deal_id = d.id and x.idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  insert into public.creator_deal_activities (deal_id, creator_user_id, kind, body, idempotency_key) values (d.id, d.creator_user_id, 'note', v_body, p_idempotency_key) returning id into v_id;
  update public.creator_deals set last_activity_at = pg_catalog.statement_timestamp() where id = d.id;
  return v_id;
end;
$function$;

revoke all on function private.deal_from_submission(public.action_submissions), private.on_submission_deal() from public, anon, authenticated;
revoke all on function public.set_creator_deal_stage(uuid,text,text), public.set_creator_deal_amount(uuid,bigint,text), public.add_creator_deal_note(uuid,text,text) from public, anon;
grant execute on function public.set_creator_deal_stage(uuid,text,text), public.set_creator_deal_amount(uuid,bigint,text), public.add_creator_deal_note(uuid,text,text) to authenticated;

-- Everything already received becomes a deal, oldest first.
do $backfill$
declare s public.action_submissions;
begin
  for s in select x.* from public.action_submissions x join public.profile_actions a on a.id = x.action_id join public.profile_modes m on m.id = a.mode_id
    where m.slug = 'creator' and x.kind = 'collab' and x.status not in ('spam','pending_verification') order by x.created_at, x.id
  loop perform private.deal_from_submission(s); end loop;
end
$backfill$;

comment on table public.creator_deals is 'Creator brand deals from Collab Actions. Owner-read under RLS; written by triggers and owner functions. Amounts are the creator''s own entries.';
comment on table public.creator_deal_activities is 'Append-only deal history: created, stage, note, amount.';
