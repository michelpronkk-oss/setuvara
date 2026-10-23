-- Two Plus appearance choices: cardStyle (solid, glass, outline) and bodyFont (sans, serif, mono).
-- Solid and sans are each Look's own and free; the others need Plus or Pro, enforced by the same
-- trigger as every premium appearance value (saved values survive a downgrade, new ones don't).

-- 1. The appearance check names every allowed key: add the two new ones to that list. The rest of
--    the (long) check is kept exactly as it is.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_catalog.pg_get_constraintdef(oid) into v_definition
  from pg_catalog.pg_constraint
  where conrelid = 'public.profile_modes'::regclass and conname = 'profile_modes_appearance_check';

  if v_definition is null then
    raise exception 'profile_modes_appearance_check is missing';
  end if;
  if pg_catalog.strpos(v_definition, '''cardStyle''::text') > 0 then
    return; -- already widened
  end if;

  v_updated := pg_catalog.replace(v_definition, '''soundtrackPresentation''::text])', '''soundtrackPresentation''::text, ''cardStyle''::text, ''bodyFont''::text])');
  if v_updated = v_definition then
    raise exception 'appearance key list not found in profile_modes_appearance_check';
  end if;

  execute 'alter table public.profile_modes drop constraint profile_modes_appearance_check, add constraint profile_modes_appearance_check ' || v_updated;
end
$migration$;

-- 2. The values the two keys may hold.
alter table public.profile_modes add constraint profile_modes_appearance_style_check check (
  ((not (appearance ? 'cardStyle')) or (jsonb_typeof(appearance -> 'cardStyle') = 'string' and (appearance ->> 'cardStyle') = any (array['solid', 'glass', 'outline'])))
  and ((not (appearance ? 'bodyFont')) or (jsonb_typeof(appearance -> 'bodyFont') = 'string' and (appearance ->> 'bodyFont') = any (array['sans', 'serif', 'mono'])))
);

-- 3. Which values need Plus.
create or replace function private.appearance_value_is_premium(p_field text, p_value jsonb)
returns boolean language sql immutable set search_path = '' as $function$
  select case
    when p_value is null or p_value = 'null'::jsonb then false
    when p_field = 'theme' then p_value #>> '{}' not in ('immersive', 'clean', 'light', 'dark')
    when p_field = 'layout' then p_value #>> '{}' in ('portrait', 'poster', 'index', 'full-portrait')
    when p_field in ('portraitZoom', 'portraitShowUsername', 'socialStyle') then false
    when p_field = 'portraitNameSize' then p_value #>> '{}' <> 'standard'
    when p_field = 'namePosition' then p_value #>> '{}' = 'top'
    when p_field = 'readability' then p_value #>> '{}' in ('soft', 'deep')
    when p_field = 'motion' then p_value #>> '{}' = 'full'
    when p_field = 'soundtrackPresentation' then p_value #>> '{}' = 'featured'
    when p_field = 'imageTreatment' then p_value #>> '{}' = 'frame'
    when p_field = 'intensity' then p_value #>> '{}' <> 'balanced'
    when p_field in ('card', 'radius', 'button', 'links') then true
    when p_field = 'soundStyle' then p_value #>> '{}' <> 'core'
    when p_field = 'qrStyle' then p_value #>> '{}' <> 'standard'
    when p_field = 'nameFont' then p_value #>> '{}' not in ('setuvara', 'modern')
    when p_field = 'scrollCue' then p_value #>> '{}' not in ('auto', 'off')
    when p_field = 'cardStyle' then p_value #>> '{}' <> 'solid'
    when p_field = 'bodyFont' then p_value #>> '{}' <> 'sans'
    else false
  end
$function$;

-- 4. The trigger checks the two new fields like the others (same list, same order as PREMIUM_FIELDS).
create or replace function private.enforce_profile_mode_appearance_plan()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  field text;
  introduced boolean := false;
begin
  -- Server-side jobs (service role, migrations) are trusted; members' own writes are checked.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  foreach field in array array[
    'theme', 'layout', 'portraitZoom', 'portraitNameSize', 'portraitShowUsername',
    'namePosition', 'readability', 'socialStyle', 'motion', 'soundtrackPresentation',
    'imageTreatment', 'intensity', 'card', 'radius', 'button', 'links', 'soundStyle', 'qrStyle', 'nameFont', 'scrollCue',
    'cardStyle', 'bodyFont'
  ] loop
    if private.appearance_value_is_premium(field, new.appearance -> field)
      and (tg_op = 'INSERT' or (old.appearance -> field) is distinct from (new.appearance -> field)) then
      introduced := true;
      exit;
    end if;
  end loop;

  if not introduced then
    return new;
  end if;

  if exists (
    select 1
    from public.billing_subscriptions s
    where s.user_id = new.profile_id
      and s.plan_code in ('plus', 'pro')
      and public.billing_subscription_has_access(
        s.provider_status, s.current_period_end, s.cancel_at_next_billing_date, s.past_due_ends_at
      )
  ) then
    return new;
  end if;

  raise exception 'appearance_requires_plus'
    using errcode = 'P0001',
      hint = 'Premium appearance values need an active Setuvara Plus or Pro membership. Saved values are kept.';
end;
$function$;
