-- Actions in every Mode.
--
--   1. Two new kinds that suit every Mode: Newsletter (email signups, confirmed
--      by email like giveaway entries) and Form (the owner's own questions).
--   2. Every kind may carry a short thank-you line for its success screen.
--   3. Owners can't count an unconfirmed entry or signup by moving it through
--      another status first: only confirmed rows become Entered or Subscribed.
--
-- profile_actions was already per Mode; the public RPC already reads any Mode.

alter table public.profile_actions drop constraint if exists profile_actions_kind_check;
alter table public.profile_actions add constraint profile_actions_kind_check
  check (kind in ('collab','giveaway','booking','submission','newsletter','form'));
alter table public.action_submissions drop constraint if exists action_submissions_kind_check;
alter table public.action_submissions add constraint action_submissions_kind_check
  check (kind in ('collab','giveaway','booking','submission','newsletter','form'));
alter table public.action_submissions drop constraint if exists action_submissions_status_check;
alter table public.action_submissions add constraint action_submissions_status_check
  check (status in ('new','reviewing','interested','accepted','answered','declined','completed','archived','spam',
    'pending_verification','entered','disqualified','subscribed','unsubscribed'));

-- One signup per normalized email (and per member) while it stands.
create unique index if not exists action_submissions_newsletter_email_idx on public.action_submissions (action_id, email_norm)
  where kind='newsletter' and status <> 'unsubscribed';
create unique index if not exists action_submissions_newsletter_member_idx on public.action_submissions (action_id, submitter_user_id)
  where kind='newsletter' and status <> 'unsubscribed' and submitter_user_id is not null;

-- Statuses each kind moves through.
create or replace function private.action_status_ok(p_kind text, p_status text)
returns boolean language sql immutable set search_path='' as $function$
  select case p_kind
    when 'collab' then p_status in ('new','reviewing','interested','declined','completed','spam')
    when 'booking' then p_status in ('new','reviewing','accepted','declined','completed','spam')
    when 'submission' then p_status in ('new','reviewing','answered','archived','spam')
    when 'form' then p_status in ('new','reviewing','answered','archived','spam')
    when 'giveaway' then p_status in ('pending_verification','entered','disqualified')
    when 'newsletter' then p_status in ('pending_verification','subscribed','unsubscribed')
    else false end
$function$;
revoke all on function private.action_status_ok(text,text) from public, anon, authenticated;

-- The config each kind accepts. Anything else is rejected.
create or replace function private.action_config_ok(p_kind text, c jsonb)
returns boolean language sql immutable set search_path='' as $function$
  select case p_kind
    when 'collab' then
      (c - array['questions','types','askBudget','askTimeline','askWebsite','availability','thanks']) = '{}'::jsonb
      and (not c ? 'types' or (jsonb_typeof(c->'types')='array' and jsonb_array_length(c->'types') between 1 and 6
        and not exists(select 1 from jsonb_array_elements_text(c->'types') t where t not in ('campaign','ugc','commission','licensing','speaking','other'))))
      and (not c ? 'askBudget' or jsonb_typeof(c->'askBudget')='boolean')
      and (not c ? 'askTimeline' or jsonb_typeof(c->'askTimeline')='boolean')
      and (not c ? 'askWebsite' or jsonb_typeof(c->'askWebsite')='boolean')
      and private.action_text_ok(c->'availability', 120)
    when 'giveaway' then
      (c - array['questions','prize','eligibility','rules','sponsor','minAge','thanks']) = '{}'::jsonb
      and private.action_text_ok(c->'prize', 200)
      and private.action_text_ok(c->'eligibility', 600)
      and private.action_text_ok(c->'rules', 6000)
      and private.action_text_ok(c->'sponsor', 120)
      and (not c ? 'minAge' or (jsonb_typeof(c->'minAge')='number' and (c->>'minAge') ~ '^(13|16|18|21)$'))
    when 'booking' then
      (c - array['questions','offering','details','priceNote','askDates','thanks']) = '{}'::jsonb
      and (not c ? 'offering' or c->>'offering' in ('booking','application'))
      and private.action_text_ok(c->'details', 1200)
      and private.action_text_ok(c->'priceNote', 80)
      and (not c ? 'askDates' or jsonb_typeof(c->'askDates')='boolean')
    when 'submission' then
      (c - array['questions','prompt','allowAnonymous','askFeatureConsent','emailRequired','thanks']) = '{}'::jsonb
      and private.action_text_ok(c->'prompt', 200)
      and (not c ? 'allowAnonymous' or jsonb_typeof(c->'allowAnonymous')='boolean')
      and (not c ? 'askFeatureConsent' or jsonb_typeof(c->'askFeatureConsent')='boolean')
      and (not c ? 'emailRequired' or jsonb_typeof(c->'emailRequired')='boolean')
    when 'newsletter' then
      (c - array['promise','frequency','sender','askName','thanks']) = '{}'::jsonb
      and private.action_text_ok(c->'promise', 200)
      and private.action_text_ok(c->'frequency', 60)
      and private.action_text_ok(c->'sender', 120)
      and (not c ? 'askName' or jsonb_typeof(c->'askName')='boolean')
    when 'form' then
      (c - array['questions','emailRequired','askName','thanks']) = '{}'::jsonb
      and (not c ? 'emailRequired' or jsonb_typeof(c->'emailRequired')='boolean')
      and (not c ? 'askName' or jsonb_typeof(c->'askName')='boolean')
    else false
  end and private.action_text_ok(c->'thanks', 200) and private.action_questions_ok(c->'questions')
$function$;


-- Submissions: newsletters confirm by email like giveaways.
create or replace function public.submit_profile_action(
  p_action_id uuid, p_submitter uuid, p_name text, p_email text, p_answers jsonb,
  p_feature_consent boolean, p_idempotency_key text, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  a public.profile_actions;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_name text := pg_catalog.left(pg_catalog.btrim(coalesce(p_name,'')), 80);
  v_email text := nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_email,''))), '');
  v_norm text;
  v_local text;
  v_domain text;
  v_answers jsonb := '{}'::jsonb;
  v_given jsonb := coalesce(p_answers, '{}'::jsonb);
  v_allowed text[];
  f jsonb;
  v_value text;
  v_id uuid;
  v_token text;
  v_existing public.action_submissions;
  v_email_required boolean;
begin
  if jsonb_typeof(v_given) <> 'object' then raise exception using errcode='22023', message='invalid_answers'; end if;
  select * into a from public.profile_actions where id=p_action_id for share;
  if not found or a.status <> 'published' or not exists(
      select 1 from public.profile_modes m join public.profiles p on p.id=m.profile_id
      where m.id=a.mode_id and m.is_enabled and p.is_published) then
    raise exception using errcode='P0002', message='action_unavailable';
  end if;
  if (a.starts_at is not null and v_now < a.starts_at) or (a.ends_at is not null and v_now >= a.ends_at) then
    raise exception using errcode='P0002', message='action_closed';
  end if;
  if p_submitter is not null and p_submitter = a.profile_id then
    raise exception using errcode='22023', message='own_action';
  end if;

  -- A retried request returns the first result.
  select * into v_existing from public.action_submissions s where s.action_id=a.id and s.idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'duplicate',true); end if;

  -- Flood guards that hold across server instances.
  if p_ip_hash is not null and (
      (select count(*) from public.action_submissions s where s.ip_hash=p_ip_hash and s.action_id=a.id and s.created_at > v_now - interval '1 hour') >= 5
      or (select count(*) from public.action_submissions s where s.ip_hash=p_ip_hash and s.created_at > v_now - interval '1 hour') >= 30) then
    raise exception using errcode='54000', message='rate_limited';
  end if;
  if (select count(*) from public.action_submissions s where s.action_id=a.id and s.created_at > v_now - interval '1 minute') >= 60 then
    raise exception using errcode='54000', message='rate_limited';
  end if;

  -- Who is writing. Collab, booking, giveaway and newsletter need an email; a name unless the kind lets it go.
  v_email_required := a.kind in ('collab','giveaway','booking','newsletter') or coalesce((a.config->>'emailRequired')::boolean, false);
  if v_email is not null and (pg_catalog.char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception using errcode='22023', message='invalid_email';
  end if;
  if v_email_required and v_email is null then raise exception using errcode='22023', message='email_required'; end if;
  if pg_catalog.char_length(v_name) = 0 and not (
      (a.kind='submission' and coalesce((a.config->>'allowAnonymous')::boolean, false))
      or a.kind='newsletter'
      or (a.kind='form' and coalesce((a.config->>'askName')::boolean, true) = false)) then
    raise exception using errcode='22023', message='name_required';
  end if;
  if v_email is not null then
    v_local := split_part(v_email,'@',1);
    v_domain := split_part(v_email,'@',2);
    v_local := split_part(v_local,'+',1);
    if v_domain in ('gmail.com','googlemail.com') then v_local := replace(v_local,'.',''); v_domain := 'gmail.com'; end if;
    v_norm := v_local||'@'||v_domain;
  end if;

  -- Built-in fields per kind, then the creator's own questions.
  v_allowed := case a.kind
    when 'collab' then array['company','collabType','budget','timeline','website','message']
    when 'booking' then array['company','preferredDates','message']
    when 'submission' then array['message']
    else array[]::text[] end;
  for v_value in select k from jsonb_object_keys(v_given) k loop
    if not (v_value = any(v_allowed)) and not exists(select 1 from jsonb_array_elements(coalesce(a.config->'questions','[]'::jsonb)) q where q->>'id'=v_value) then
      raise exception using errcode='22023', message='unknown_field';
    end if;
    if jsonb_typeof(v_given->v_value) <> 'string' then raise exception using errcode='22023', message='invalid_answers'; end if;
  end loop;

  if a.kind='collab' then
    v_value := pg_catalog.btrim(coalesce(v_given->>'collabType',''));
    if v_value = '' or not (v_value in (select jsonb_array_elements_text(coalesce(a.config->'types','["campaign","ugc","commission","licensing","speaking","other"]'::jsonb)))) then
      raise exception using errcode='22023', message='invalid_collab_type';
    end if;
    v_answers := v_answers || jsonb_build_object('collabType', v_value);
    v_value := pg_catalog.btrim(coalesce(v_given->>'budget',''));
    if v_value <> '' and v_value not in ('under_1k','1k_5k','5k_10k','10k_25k','25k_plus','unsure') then raise exception using errcode='22023', message='invalid_budget'; end if;
    if v_value <> '' then v_answers := v_answers || jsonb_build_object('budget', v_value); end if;
    v_value := pg_catalog.btrim(coalesce(v_given->>'website',''));
    if v_value <> '' and (pg_catalog.char_length(v_value) > 300 or v_value !~* '^https?://[^\s/]+\.[^\s]+$') then raise exception using errcode='22023', message='invalid_website'; end if;
    if v_value <> '' then v_answers := v_answers || jsonb_build_object('website', v_value); end if;
    foreach v_value in array array['company','timeline'] loop
      if pg_catalog.char_length(pg_catalog.btrim(coalesce(v_given->>v_value,''))) > 120 then raise exception using errcode='22023', message='too_long'; end if;
      if pg_catalog.btrim(coalesce(v_given->>v_value,'')) <> '' then v_answers := v_answers || jsonb_build_object(v_value, pg_catalog.btrim(v_given->>v_value)); end if;
    end loop;
  elsif a.kind='booking' then
    foreach v_value in array array['company','preferredDates'] loop
      if pg_catalog.char_length(pg_catalog.btrim(coalesce(v_given->>v_value,''))) > 120 then raise exception using errcode='22023', message='too_long'; end if;
      if pg_catalog.btrim(coalesce(v_given->>v_value,'')) <> '' then v_answers := v_answers || jsonb_build_object(v_value, pg_catalog.btrim(v_given->>v_value)); end if;
    end loop;
  end if;
  if a.kind in ('collab','booking','submission') then
    v_value := pg_catalog.btrim(coalesce(v_given->>'message',''));
    if pg_catalog.char_length(v_value) not between 1 and 2000 then raise exception using errcode='22023', message='message_required'; end if;
    v_answers := v_answers || jsonb_build_object('message', v_value);
  end if;
  for f in select q from jsonb_array_elements(coalesce(a.config->'questions','[]'::jsonb)) q loop
    v_value := pg_catalog.btrim(coalesce(v_given->>(f->>'id'),''));
    if v_value = '' then
      if coalesce((f->>'required')::boolean,false) then raise exception using errcode='22023', message='answer_required'; end if;
      continue;
    end if;
    if pg_catalog.char_length(v_value) > (case f->>'type' when 'long' then 2000 else 200 end) then raise exception using errcode='22023', message='too_long'; end if;
    if f->>'type'='choice' and not (v_value in (select jsonb_array_elements_text(f->'options'))) then raise exception using errcode='22023', message='invalid_choice'; end if;
    v_answers := v_answers || jsonb_build_object(f->>'id', v_value);
  end loop;

  if a.kind in ('giveaway','newsletter') then
    -- Same email or member twice is not a second entry or signup. The response
    -- does not say which, so the form can't be used to test who is on a list.
    if exists(select 1 from public.action_submissions s where s.action_id=a.id and s.status not in ('disqualified','unsubscribed')
        and (s.email_norm=v_norm or (p_submitter is not null and s.submitter_user_id=p_submitter))) then
      return jsonb_build_object('id',null,'status','pending_verification','duplicate',true);
    end if;
    v_token := encode(extensions.gen_random_bytes(32),'hex');
  end if;

  insert into public.action_submissions(action_id,profile_id,kind,submitter_user_id,name,email,email_norm,answers,status,feature_consent,
      verify_token_hash,verify_expires_at,ip_hash,idempotency_key)
    values(a.id,a.profile_id,a.kind,p_submitter,v_name,v_email,v_norm,v_answers,
      case when a.kind in ('giveaway','newsletter') then 'pending_verification' else 'new' end,
      a.kind='submission' and coalesce((a.config->>'askFeatureConsent')::boolean,false) and coalesce(p_feature_consent,false),
      case when v_token is null then null else extensions.digest(v_token,'sha256') end,
      case when v_token is null then null else v_now + interval '48 hours' end,
      p_ip_hash, p_idempotency_key)
    on conflict do nothing
    returning id into v_id;
  if v_id is null then
    return jsonb_build_object('id',null,'status','pending_verification','duplicate',true);
  end if;
  return jsonb_build_object('id',v_id,'status',case when a.kind in ('giveaway','newsletter') then 'pending_verification' else 'new' end,'duplicate',false,'verify_token',v_token);
end;
$function$;


-- Confirms a giveaway entry or a newsletter signup from the emailed link.
create or replace function public.confirm_action_entry(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  s public.action_submissions;
  a public.profile_actions;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'reason','invalid'); end if;
  select * into s from public.action_submissions where verify_token_hash=extensions.digest(p_token,'sha256') for update;
  if not found then return jsonb_build_object('ok',false,'reason','invalid'); end if;
  select * into a from public.profile_actions where id=s.action_id;
  if s.verify_expires_at < pg_catalog.statement_timestamp() then
    return jsonb_build_object('ok',false,'reason','expired','action_id',a.id);
  end if;
  if a.status <> 'published' or (a.ends_at is not null and pg_catalog.statement_timestamp() >= a.ends_at) then
    return jsonb_build_object('ok',false,'reason','closed','action_id',a.id);
  end if;
  update public.action_submissions set status=case when s.kind='newsletter' then 'subscribed' else 'entered' end, verified_at=pg_catalog.statement_timestamp(), verify_token_hash=null, verify_expires_at=null
    where id=s.id;
  return jsonb_build_object('ok',true,'action_id',a.id,'title',a.title,'kind',a.kind);
end;
$function$;


-- Owner tools: an unconfirmed entry or signup never counts.
create or replace function public.set_action_submission_status(p_submission_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path='' as $function$
declare s public.action_submissions;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into s from public.action_submissions where id=p_submission_id and profile_id=auth.uid() for update;
  if not found then return false; end if;
  if not private.action_status_ok(s.kind, p_status) or p_status='pending_verification'
     or (p_status in ('entered','subscribed') and s.verified_at is null) then
    raise exception using errcode='22023', message='invalid_status';
  end if;
  update public.action_submissions set status=p_status where id=s.id;
  return true;
end;
$function$;

revoke all on function private.action_config_ok(text,jsonb) from public, anon, authenticated;
revoke all on function public.submit_profile_action(uuid,uuid,text,text,jsonb,boolean,text,text) from public, anon, authenticated;
grant execute on function public.submit_profile_action(uuid,uuid,text,text,jsonb,boolean,text,text) to service_role;
revoke all on function public.confirm_action_entry(text) from public, anon, authenticated;
grant execute on function public.confirm_action_entry(text) to service_role;
revoke all on function public.set_action_submission_status(uuid,text) from public, anon;
grant execute on function public.set_action_submission_status(uuid,text) to authenticated;
