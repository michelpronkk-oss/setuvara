-- Creator Actions and platform accounts.
--
--   1. Actions: Collaboration requests, Giveaways, Bookings & applications and
--      Questions & fan submissions, published on a Mode's public page. The
--      tables are per Mode so Business and Event can use them later.
--   2. Submissions: written only by trusted server routes (service role),
--      read and managed only by the owner. A submission never creates a chat.
--   3. Plan limits enforced here, from a configurable table.
--   4. Platform accounts: OAuth-connected YouTube, Twitch, TikTok and
--      Instagram identities and their synced audience counts. Tokens are
--      stored encrypted by the app and never reach clients.
--
-- Supersedes the signed-in-only collab inquiries from 20261020130000, which
-- never held production data: collaboration requests are now an Action.

drop function if exists public.creator_send_inquiry(text,text,text,text,text,text);
drop function if exists public.creator_set_inquiry_status(uuid,text);
drop table if exists public.creator_inquiries;

-- Creator settings: the collabs keys move onto the Collaboration Action and the
-- page section list names Actions instead.
alter table public.profile_modes drop constraint if exists profile_modes_settings_fields_check;
update public.profile_modes
  set settings = (settings - array['collabsOpen','collabsNote','collabsPitch'])
    || case when settings ? 'sections'
         then jsonb_build_object('sections', replace(settings->>'sections','collabs','actions'))
         else '{}'::jsonb end
  where slug='creator' and (settings ?| array['collabsOpen','collabsNote','collabsPitch','sections']);
alter table public.profile_modes add constraint profile_modes_settings_fields_check check (
  case slug
    when 'personal' then
      settings - array['note','location','pronouns'] = '{}'::jsonb
      and (not settings ? 'note' or (jsonb_typeof(settings->'note')='string' and char_length(settings->>'note')<=280))
      and (not settings ? 'location' or (jsonb_typeof(settings->'location')='string' and char_length(settings->>'location')<=80))
      and (not settings ? 'pronouns' or (jsonb_typeof(settings->'pronouns')='string' and char_length(settings->>'pronouns')<=40))
    when 'event' then
      settings - array['eventName','city','countryCode','dateLabel','role','hereToMeet'] = '{}'::jsonb
      and (not settings ? 'eventName' or (jsonb_typeof(settings->'eventName')='string' and char_length(settings->>'eventName')<=100))
      and (not settings ? 'city' or (jsonb_typeof(settings->'city')='string' and char_length(settings->>'city')<=80))
      and (not settings ? 'countryCode' or (jsonb_typeof(settings->'countryCode')='string' and (settings->>'countryCode'='' or settings->>'countryCode' ~ '^[A-Z]{2}$')))
      and (not settings ? 'dateLabel' or (jsonb_typeof(settings->'dateLabel')='string' and char_length(settings->>'dateLabel')<=80))
      and (not settings ? 'role' or (jsonb_typeof(settings->'role')='string' and char_length(settings->>'role')<=80))
      and (not settings ? 'hereToMeet' or (jsonb_typeof(settings->'hereToMeet')='string' and char_length(settings->>'hereToMeet')<=280))
    when 'business' then
      settings - array['role','company','city','description','contactEmail','showContactEmail','bookingLabel','bookingUrl'] = '{}'::jsonb
      and (not settings ? 'role' or (jsonb_typeof(settings->'role')='string' and char_length(settings->>'role')<=80))
      and (not settings ? 'company' or (jsonb_typeof(settings->'company')='string' and char_length(settings->>'company')<=100))
      and (not settings ? 'city' or (jsonb_typeof(settings->'city')='string' and char_length(settings->>'city')<=80))
      and (not settings ? 'description' or (jsonb_typeof(settings->'description')='string' and char_length(settings->>'description')<=280))
      and (not settings ? 'contactEmail' or (jsonb_typeof(settings->'contactEmail')='string' and char_length(settings->>'contactEmail')<=254))
      and (not settings ? 'showContactEmail' or jsonb_typeof(settings->'showContactEmail')='boolean')
      and (not settings ? 'bookingLabel' or (jsonb_typeof(settings->'bookingLabel')='string' and char_length(settings->>'bookingLabel')<=60))
      and (not settings ? 'bookingUrl' or (jsonb_typeof(settings->'bookingUrl')='string' and char_length(settings->>'bookingUrl')<=2048))
    when 'creator' then
      settings - array['tagline','category','city','sections'] = '{}'::jsonb
      and (not settings ? 'tagline' or (jsonb_typeof(settings->'tagline')='string' and char_length(settings->>'tagline')<=280))
      and (not settings ? 'category' or (jsonb_typeof(settings->'category')='string' and char_length(settings->>'category')<=80))
      and (not settings ? 'city' or (jsonb_typeof(settings->'city')='string' and char_length(settings->>'city')<=80))
      and (not settings ? 'sections' or (jsonb_typeof(settings->'sections')='string'
        and settings->>'sections' ~ '^((featured|work|store|actions)(,(featured|work|store|actions)){0,3})?$'))
    else false
  end
);

-- 3. Plan limits. One row per plan; change limits here without a release.
create table private.action_plan_limits (
  plan_code text primary key check (plan_code in ('free','plus','pro')),
  published_actions integer not null check (published_actions between 0 and 100),
  open_giveaways integer not null check (open_giveaways between 0 and 50),
  custom_questions integer not null check (custom_questions between 0 and 12),
  can_export boolean not null
);
insert into private.action_plan_limits values
  ('free', 2, 0, 3, false),
  ('plus', 8, 1, 6, true),
  ('pro', 24, 5, 12, true);
revoke all on private.action_plan_limits from public, anon, authenticated;

-- The member's current plan, from canonical billing (same rule as the slides trigger).
create function private.member_plan(p_user uuid)
returns text language sql stable security definer set search_path='' as $function$
  select coalesce((
    select case when bool_or(s.plan_code='pro') then 'pro' else 'plus' end
    from public.billing_subscriptions s
    where s.user_id=p_user and s.plan_code in ('plus','pro')
      and public.billing_subscription_has_access(s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at)
    having count(*) > 0
  ), 'free')
$function$;
revoke all on function private.member_plan(uuid) from public, anon, authenticated;

-- 1. Actions.
create table public.profile_actions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  mode_id uuid not null references public.profile_modes(id) on delete cascade,
  kind text not null check (kind in ('collab','giveaway','booking','submission')),
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  intro text not null default '' check (char_length(intro) <= 600),
  cta_label text not null default '' check (char_length(cta_label) <= 40),
  -- Optional imagery: a picture already on this Mode (its own public rules apply).
  cover_block_id uuid references public.profile_blocks(id) on delete set null,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config)='object' and pg_column_size(config) <= 16384),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (kind <> 'giveaway' or status = 'draft' or ends_at is not null)
);
create index profile_actions_owner_idx on public.profile_actions (profile_id, mode_id, sort_order);
create index profile_actions_public_idx on public.profile_actions (mode_id, sort_order) where status='published';

-- Short text with a cap, or absent.
create function private.action_text_ok(p_value jsonb, p_max integer)
returns boolean language sql immutable set search_path='' as $function$
  select p_value is null or (jsonb_typeof(p_value)='string' and char_length(p_value #>> '{}') <= p_max)
$function$;

-- Custom questions: [{id, label, type: short|long|choice, options?, required?}].
create function private.action_questions_ok(p_fields jsonb)
returns boolean language sql immutable set search_path='' as $function$
  select p_fields is null or (
    jsonb_typeof(p_fields)='array' and jsonb_array_length(p_fields) <= 12
    and (select count(distinct f->>'id') from jsonb_array_elements(p_fields) f) = jsonb_array_length(p_fields)
    and not exists(select 1 from jsonb_array_elements(p_fields) f where
      jsonb_typeof(f) <> 'object'
      or (f - array['id','label','type','options','required']) <> '{}'::jsonb
      or coalesce(f->>'id','') !~ '^q[0-9]{1,2}$'
      or jsonb_typeof(f->'label') is distinct from 'string' or char_length(btrim(f->>'label')) not between 1 and 120
      or coalesce(f->>'type','') not in ('short','long','choice')
      or (f ? 'required' and jsonb_typeof(f->'required') <> 'boolean')
      or (f->>'type'='choice') <> (f ? 'options')
      or (f ? 'options' and (jsonb_typeof(f->'options') <> 'array' or jsonb_array_length(f->'options') not between 2 and 8
        or exists(select 1 from jsonb_array_elements(f->'options') o where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 60))))
  )
$function$;

-- The config each kind accepts. Anything else is rejected.
create function private.action_config_ok(p_kind text, c jsonb)
returns boolean language sql immutable set search_path='' as $function$
  select case p_kind
    when 'collab' then
      (c - array['questions','types','askBudget','askTimeline','askWebsite','availability']) = '{}'::jsonb
      and (not c ? 'types' or (jsonb_typeof(c->'types')='array' and jsonb_array_length(c->'types') between 1 and 6
        and not exists(select 1 from jsonb_array_elements_text(c->'types') t where t not in ('campaign','ugc','commission','licensing','speaking','other'))))
      and (not c ? 'askBudget' or jsonb_typeof(c->'askBudget')='boolean')
      and (not c ? 'askTimeline' or jsonb_typeof(c->'askTimeline')='boolean')
      and (not c ? 'askWebsite' or jsonb_typeof(c->'askWebsite')='boolean')
      and private.action_text_ok(c->'availability', 120)
    when 'giveaway' then
      (c - array['questions','prize','eligibility','rules','sponsor','minAge']) = '{}'::jsonb
      and private.action_text_ok(c->'prize', 200)
      and private.action_text_ok(c->'eligibility', 600)
      and private.action_text_ok(c->'rules', 6000)
      and private.action_text_ok(c->'sponsor', 120)
      and (not c ? 'minAge' or (jsonb_typeof(c->'minAge')='number' and (c->>'minAge') ~ '^(13|16|18|21)$'))
    when 'booking' then
      (c - array['questions','offering','details','priceNote','askDates']) = '{}'::jsonb
      and (not c ? 'offering' or c->>'offering' in ('booking','application'))
      and private.action_text_ok(c->'details', 1200)
      and private.action_text_ok(c->'priceNote', 80)
      and (not c ? 'askDates' or jsonb_typeof(c->'askDates')='boolean')
    when 'submission' then
      (c - array['questions','prompt','allowAnonymous','askFeatureConsent','emailRequired']) = '{}'::jsonb
      and private.action_text_ok(c->'prompt', 200)
      and (not c ? 'allowAnonymous' or jsonb_typeof(c->'allowAnonymous')='boolean')
      and (not c ? 'askFeatureConsent' or jsonb_typeof(c->'askFeatureConsent')='boolean')
      and (not c ? 'emailRequired' or jsonb_typeof(c->'emailRequired')='boolean')
    else false
  end and private.action_questions_ok(c->'questions')
$function$;
revoke all on function private.action_text_ok(jsonb,integer), private.action_questions_ok(jsonb), private.action_config_ok(text,jsonb) from public, anon, authenticated;

create table public.action_submissions (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.profile_actions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('collab','giveaway','booking','submission')),
  submitter_user_id uuid references public.profiles(id) on delete set null,
  name text not null default '' check (char_length(name) <= 80),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  email_norm text check (email_norm is null or char_length(email_norm) <= 254),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers)='object' and pg_column_size(answers) <= 32768),
  status text not null check (status in ('new','reviewing','interested','accepted','answered','declined','completed','archived','spam','pending_verification','entered','disqualified')),
  feature_consent boolean not null default false,
  verify_token_hash bytea,
  verify_expires_at timestamptz,
  verified_at timestamptz,
  ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (action_id, idempotency_key)
);
create index action_submissions_owner_idx on public.action_submissions (profile_id, created_at desc);
create index action_submissions_action_idx on public.action_submissions (action_id, status, created_at desc);
create index action_submissions_ip_idx on public.action_submissions (ip_hash, created_at desc) where ip_hash is not null;
create unique index action_submissions_verify_idx on public.action_submissions (verify_token_hash) where verify_token_hash is not null;
-- One live giveaway entry per normalized email, and per signed-in member.
create unique index action_submissions_giveaway_email_idx on public.action_submissions (action_id, email_norm)
  where kind='giveaway' and status <> 'disqualified';
create unique index action_submissions_giveaway_member_idx on public.action_submissions (action_id, submitter_user_id)
  where kind='giveaway' and status <> 'disqualified' and submitter_user_id is not null;

-- Statuses each kind moves through.
create function private.action_status_ok(p_kind text, p_status text)
returns boolean language sql immutable set search_path='' as $function$
  select case p_kind
    when 'collab' then p_status in ('new','reviewing','interested','declined','completed','spam')
    when 'booking' then p_status in ('new','reviewing','accepted','declined','completed','spam')
    when 'submission' then p_status in ('new','reviewing','answered','archived','spam')
    when 'giveaway' then p_status in ('pending_verification','entered','disqualified')
    else false end
$function$;
revoke all on function private.action_status_ok(text,text) from public, anon, authenticated;
alter table public.action_submissions add constraint action_submissions_status_kind_check check (private.action_status_ok(kind, status));

-- Validation, lifecycle and plan limits for Actions.
create function private.validate_profile_action() returns trigger language plpgsql security definer set search_path='' as $function$
declare
  v_plan text;
  v_limits private.action_plan_limits;
  v_trusted boolean := coalesce(auth.role(),'') not in ('authenticated','anon');
  v_has_entries boolean;
begin
  if not exists(select 1 from public.profile_modes m where m.id=new.mode_id and m.profile_id=new.profile_id) then
    raise exception using errcode='23514', message='action_mode_mismatch';
  end if;
  if new.cover_block_id is not null and not exists(select 1 from public.profile_blocks b
      where b.id=new.cover_block_id and b.mode_id=new.mode_id and b.profile_id=new.profile_id and b.kind='image') then
    raise exception using errcode='23514', message='action_cover_invalid';
  end if;
  if not private.action_config_ok(new.kind, new.config) then
    raise exception using errcode='23514', message='action_config_invalid';
  end if;
  if tg_op='UPDATE' then
    if new.kind <> old.kind or new.profile_id <> old.profile_id or new.mode_id <> old.mode_id then
      raise exception using errcode='23514', message='action_identity_locked';
    end if;
    -- A giveaway's terms are fixed once people have entered.
    if new.kind='giveaway' and (new.config is distinct from old.config or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.title <> old.title) then
      select exists(select 1 from public.action_submissions s where s.action_id=new.id) into v_has_entries;
      if v_has_entries then raise exception using errcode='23514', message='giveaway_terms_locked'; end if;
    end if;
  end if;

  if new.status='published' and (tg_op='INSERT' or old.status <> 'published') then
    new.published_at := pg_catalog.statement_timestamp();
    if new.kind='giveaway' and new.ends_at <= pg_catalog.statement_timestamp() then
      raise exception using errcode='23514', message='giveaway_already_ended';
    end if;
    if not v_trusted then
      v_plan := private.member_plan(new.profile_id);
      select * into v_limits from private.action_plan_limits where plan_code=v_plan;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile_actions:'||new.profile_id::text, 0));
      if (select count(*) from public.profile_actions a where a.profile_id=new.profile_id and a.status='published' and a.id <> new.id) >= v_limits.published_actions then
        raise exception using errcode='P0001', message='plan_action_limit';
      end if;
      if new.kind='giveaway' and (select count(*) from public.profile_actions a where a.profile_id=new.profile_id and a.kind='giveaway'
          and a.status='published' and a.id <> new.id) >= v_limits.open_giveaways then
        raise exception using errcode='P0001', message='plan_giveaway_limit';
      end if;
    end if;
  end if;
  -- Live questions stay inside the plan, also when a live Action is edited.
  if new.status='published' and not v_trusted
     and jsonb_array_length(coalesce(new.config->'questions','[]'::jsonb)) > (
       select l.custom_questions from private.action_plan_limits l where l.plan_code=private.member_plan(new.profile_id)) then
    raise exception using errcode='P0001', message='plan_question_limit';
  end if;
  if new.status='closed' and (tg_op='INSERT' or old.status <> 'closed') then new.closed_at := pg_catalog.statement_timestamp(); end if;
  return new;
end;
$function$;
revoke all on function private.validate_profile_action() from public, anon, authenticated;
create trigger profile_actions_validate before insert or update on public.profile_actions
  for each row execute function private.validate_profile_action();
create trigger profile_actions_set_updated_at before update on public.profile_actions
  for each row execute function private.set_updated_at();
create trigger action_submissions_set_updated_at before update on public.action_submissions
  for each row execute function private.set_updated_at();

alter table public.profile_actions enable row level security;
alter table public.action_submissions enable row level security;
revoke all on public.profile_actions, public.action_submissions from public, anon, authenticated;
grant select, insert, update, delete on public.profile_actions to authenticated;
-- Owners read everything except the verification secret and the IP hash.
grant select (id, action_id, profile_id, kind, submitter_user_id, name, email, answers, status, feature_consent, verified_at, created_at, updated_at)
  on public.action_submissions to authenticated;
grant all on public.profile_actions, public.action_submissions to service_role;
create policy profile_actions_owner_all on public.profile_actions for all to authenticated
  using (profile_id=(select auth.uid())) with check (profile_id=(select auth.uid()));
create policy action_submissions_owner_read on public.action_submissions for select to authenticated
  using (profile_id=(select auth.uid()));

-- The Actions a visitor sees on a live Mode page. Config is public by design
-- (rules, prize, questions); counts and submissions are not.
create function public.get_public_profile_actions(p_username text, p_mode text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'kind',a.kind,'title',a.title,'intro',a.intro,'cta_label',a.cta_label,
      'cover_block_id',a.cover_block_id,'config',a.config,'starts_at',a.starts_at,'ends_at',a.ends_at)
    order by a.sort_order, a.created_at), '[]'::jsonb)
  from public.profiles p
  join public.profile_modes m on m.profile_id=p.id and m.slug=p_mode and m.is_enabled
  join public.profile_actions a on a.mode_id=m.id and a.status='published'
  where p.username=pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
$function$;
revoke all on function public.get_public_profile_actions(text,text) from public;
grant execute on function public.get_public_profile_actions(text,text) to anon, authenticated, service_role;

-- 2. Submissions. Called only by the server route, which has already checked
-- origin, the spam trap and per-IP limits and passes a salted IP hash.
create function public.submit_profile_action(
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

  -- Who is writing. Collab, booking and giveaway need a name and an email.
  v_email_required := a.kind in ('collab','giveaway','booking') or coalesce((a.config->>'emailRequired')::boolean, false);
  if v_email is not null and (pg_catalog.char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception using errcode='22023', message='invalid_email';
  end if;
  if v_email_required and v_email is null then raise exception using errcode='22023', message='email_required'; end if;
  if pg_catalog.char_length(v_name) = 0 and not (a.kind='submission' and coalesce((a.config->>'allowAnonymous')::boolean, false)) then
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

  if a.kind='giveaway' then
    -- Same email or member twice is not a second entry. The response does not
    -- say which, so the form can't be used to test who entered.
    if exists(select 1 from public.action_submissions s where s.action_id=a.id and s.status <> 'disqualified'
        and (s.email_norm=v_norm or (p_submitter is not null and s.submitter_user_id=p_submitter))) then
      return jsonb_build_object('id',null,'status','pending_verification','duplicate',true);
    end if;
    v_token := encode(extensions.gen_random_bytes(32),'hex');
  end if;

  insert into public.action_submissions(action_id,profile_id,kind,submitter_user_id,name,email,email_norm,answers,status,feature_consent,
      verify_token_hash,verify_expires_at,ip_hash,idempotency_key)
    values(a.id,a.profile_id,a.kind,p_submitter,v_name,v_email,v_norm,v_answers,
      case when a.kind='giveaway' then 'pending_verification' else 'new' end,
      a.kind='submission' and coalesce((a.config->>'askFeatureConsent')::boolean,false) and coalesce(p_feature_consent,false),
      case when v_token is null then null else extensions.digest(v_token,'sha256') end,
      case when v_token is null then null else v_now + interval '48 hours' end,
      p_ip_hash, p_idempotency_key)
    on conflict do nothing
    returning id into v_id;
  if v_id is null then
    return jsonb_build_object('id',null,'status','pending_verification','duplicate',true);
  end if;
  return jsonb_build_object('id',v_id,'status',case when a.kind='giveaway' then 'pending_verification' else 'new' end,'duplicate',false,'verify_token',v_token);
end;
$function$;
revoke all on function public.submit_profile_action(uuid,uuid,text,text,jsonb,boolean,text,text) from public, anon, authenticated;
grant execute on function public.submit_profile_action(uuid,uuid,text,text,jsonb,boolean,text,text) to service_role;

-- Confirms a giveaway entry from the emailed link, while the giveaway is open.
create function public.confirm_action_entry(p_token text)
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
  update public.action_submissions set status='entered', verified_at=pg_catalog.statement_timestamp(), verify_token_hash=null, verify_expires_at=null
    where id=s.id;
  return jsonb_build_object('ok',true,'action_id',a.id,'title',a.title);
end;
$function$;
revoke all on function public.confirm_action_entry(text) from public, anon, authenticated;
grant execute on function public.confirm_action_entry(text) to service_role;

-- Owner tools.
create function public.set_action_submission_status(p_submission_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path='' as $function$
declare s public.action_submissions;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into s from public.action_submissions where id=p_submission_id and profile_id=auth.uid() for update;
  if not found then return false; end if;
  if not private.action_status_ok(s.kind, p_status) or p_status='pending_verification'
     or (s.kind='giveaway' and s.status='pending_verification' and p_status='entered') then
    raise exception using errcode='22023', message='invalid_status';
  end if;
  update public.action_submissions set status=p_status where id=s.id;
  return true;
end;
$function$;
revoke all on function public.set_action_submission_status(uuid,text) from public, anon;
grant execute on function public.set_action_submission_status(uuid,text) to authenticated;

create function public.delete_action_submission(p_submission_id uuid)
returns boolean language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  delete from public.action_submissions where id=p_submission_id and profile_id=auth.uid();
  return found;
end;
$function$;
revoke all on function public.delete_action_submission(uuid) from public, anon;
grant execute on function public.delete_action_submission(uuid) to authenticated;

-- What the owner's plan allows, for the studio.
create function public.my_action_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan',l.plan_code,'published_actions',l.published_actions,'open_giveaways',l.open_giveaways,
    'custom_questions',l.custom_questions,'can_export',l.can_export)
  from private.action_plan_limits l where l.plan_code=private.member_plan(auth.uid())
$function$;
revoke all on function public.my_action_limits() from public, anon;
grant execute on function public.my_action_limits() to authenticated;

-- Export is a plan feature: the route checks it here as the owner.
create function public.can_export_action(p_action_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
  select exists(select 1 from public.profile_actions a where a.id=p_action_id and a.profile_id=auth.uid())
    and (select l.can_export from private.action_plan_limits l where l.plan_code=private.member_plan(auth.uid()))
$function$;
revoke all on function public.can_export_action(uuid) from public, anon;
grant execute on function public.can_export_action(uuid) to authenticated;

-- Retention: unconfirmed entries after 7 days; entrant contact details 180 days
-- after a giveaway ends. Schedule with pg_cron or call from a server job.
create function public.purge_action_submissions()
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_pending integer; v_ended integer;
begin
  delete from public.action_submissions where status='pending_verification' and created_at < pg_catalog.statement_timestamp() - interval '7 days';
  get diagnostics v_pending = row_count;
  update public.action_submissions s set email=null, email_norm=null, name='', answers='{}'::jsonb
    from public.profile_actions a
    where a.id=s.action_id and s.kind='giveaway' and s.email is not null
      and a.ends_at < pg_catalog.statement_timestamp() - interval '180 days';
  get diagnostics v_ended = row_count;
  return jsonb_build_object('pending_deleted',v_pending,'entries_minimized',v_ended);
end;
$function$;
revoke all on function public.purge_action_submissions() from public, anon, authenticated;
grant execute on function public.purge_action_submissions() to service_role;

-- 4. Platform accounts.
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('youtube','twitch','tiktok','instagram')),
  provider_account_id text not null check (char_length(provider_account_id) between 1 and 200),
  username text not null default '' check (char_length(username) <= 120),
  display_name text not null default '' check (char_length(display_name) <= 120),
  profile_url text check (profile_url is null or (char_length(profile_url) <= 500 and profile_url ~ '^https://')),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2000 and avatar_url ~ '^https://')),
  audience_count bigint check (audience_count is null or audience_count >= 0),
  audience_hidden boolean not null default false,
  status text not null default 'connected' check (status in ('connected','needs_reauth','error')),
  last_synced_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 200),
  show_on_page boolean not null default true,
  connected_at timestamptz not null default pg_catalog.statement_timestamp(),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (profile_id, provider),
  unique (provider, provider_account_id)
);
create trigger social_accounts_set_updated_at before update on public.social_accounts
  for each row execute function private.set_updated_at();
alter table public.social_accounts enable row level security;
revoke all on public.social_accounts from public, anon, authenticated;
grant select on public.social_accounts to authenticated;
grant update (show_on_page) on public.social_accounts to authenticated;
grant all on public.social_accounts to service_role;
create policy social_accounts_owner_read on public.social_accounts for select to authenticated using (profile_id=(select auth.uid()));
create policy social_accounts_owner_display on public.social_accounts for update to authenticated
  using (profile_id=(select auth.uid())) with check (profile_id=(select auth.uid()));

-- Encrypted by the app (AES-256-GCM, key outside the database). Service role only.
create table public.social_account_secrets (
  account_id uuid primary key references public.social_accounts(id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text not null default '',
  updated_at timestamptz not null default pg_catalog.statement_timestamp()
);
alter table public.social_account_secrets enable row level security;
revoke all on public.social_account_secrets from public, anon, authenticated;
grant all on public.social_account_secrets to service_role;

-- Verified accounts a visitor sees on a live Creator page.
create function public.get_creator_platforms(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'provider',s.provider,'username',s.username,'display_name',s.display_name,'profile_url',s.profile_url,
      'avatar_url',s.avatar_url,'audience_count',case when s.audience_hidden then null else s.audience_count end,
      'last_synced_at',s.last_synced_at)
    order by array_position(array['instagram','tiktok','youtube','twitch'], s.provider)), '[]'::jsonb)
  from public.profiles p
  join public.profile_modes m on m.profile_id=p.id and m.slug='creator' and m.is_enabled
  join public.social_accounts s on s.profile_id=p.id and s.show_on_page and s.status='connected'
  where p.username=pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
$function$;
revoke all on function public.get_creator_platforms(text) from public;
grant execute on function public.get_creator_platforms(text) to anon, authenticated, service_role;

comment on table public.profile_actions is 'Creator Actions (collab, giveaway, booking, submission) on a Mode page. Owner-managed via RLS; plan limits in private.action_plan_limits.';
comment on table public.action_submissions is 'Visitor submissions to Actions. Written only by public.submit_profile_action from the server route; read by the Action owner.';
comment on table public.social_accounts is 'OAuth-connected platform identities and synced audience counts. Written by server routes only.';
comment on table public.social_account_secrets is 'App-encrypted OAuth tokens for social_accounts. Service role only.';

-- The kit says whether platforms are included, so verified accounts follow the same switch.
create or replace function public.get_creator_media_kit(p_username text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object(
    'display_name',p.display_name,
    'username',p.username,
    'tagline',coalesce(m.settings->>'tagline',''),
    'category',coalesce(m.settings->>'category',''),
    'city',coalesce(m.settings->>'city',''),
    'languages',coalesce(k.languages,''),
    'show_platforms',coalesce(k.show_platforms,true),
    'updated_at',greatest(m.updated_at,coalesce(k.updated_at,m.updated_at)),
    'platforms',case when coalesce(k.show_platforms,true) then coalesce((select jsonb_agg(jsonb_build_object('type',l.link_type,'url',l.url) order by l.sort_order)
      from public.profile_links l where l.profile_id=p.id and l.mode_id=m.id and l.is_visible
        and l.link_type in ('instagram','tiktok','youtube','twitch','x','threads','spotify','substack','patreon')),'[]'::jsonb) else '[]'::jsonb end,
    'partners',case when coalesce(k.show_partners,true) then to_jsonb(coalesce(k.partners,'{}'::text[])) else '[]'::jsonb end,
    'rates',case when coalesce(k.show_rates,true) then coalesce(k.rates,'[]'::jsonb) else '[]'::jsonb end,
    'contact_email',case when k.show_contact then k.contact_email else null end
  )
  from public.profiles p
  join public.profile_modes m on m.profile_id=p.id and m.slug='creator'
  left join public.creator_media_kits k on k.user_id=p.id
  where p.username=lower(btrim(p_username)) and p.is_published and m.is_enabled;
$function$;
