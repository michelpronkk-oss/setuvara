-- Setuvara Appearance system.
--
-- 1. The existing profile_modes.appearance JSON gains the approved curated choices:
--    themes noir · signal · studio, the Mode-independent layouts portrait · poster · index,
--    the frame image treatment, more QR frames, and optional refinements (intensity, card,
--    radius, button, links, soundStyle). Every value is an enumerated id; no CSS is stored.
--    Existing rows already satisfy the new check, so no data is rewritten.
-- 2. A trigger refuses NEW premium values from accounts without an active Plus or Pro
--    subscription. Values that are already saved stay untouched (lock capability, never
--    delete configuration), so a downgraded member keeps their saved look and can still
--    edit everything else. Rendering resolves the plan server-side as before.
-- No table, column or RLS policy changes.

alter table public.profile_modes
  drop constraint profile_modes_appearance_check;

alter table public.profile_modes
  add constraint profile_modes_appearance_check
    check (
      jsonb_typeof(appearance) = 'object'
      and appearance ?& array['theme', 'accent', 'layout', 'imageTreatment']
      and appearance - array[
        'theme', 'accent', 'layout', 'imageTreatment', 'qrStyle',
        'intensity', 'card', 'radius', 'button', 'links', 'soundStyle'
      ] = '{}'::jsonb
      and jsonb_typeof(appearance -> 'theme') = 'string'
      and jsonb_typeof(appearance -> 'accent') = 'string'
      and jsonb_typeof(appearance -> 'layout') = 'string'
      and jsonb_typeof(appearance -> 'imageTreatment') = 'string'
      and appearance ->> 'theme' in ('light', 'dark', 'editorial', 'noir', 'signal', 'studio')
      and appearance ->> 'accent' ~ '^#[0-9A-Fa-f]{6}$'
      and (
        appearance ->> 'layout' in ('portrait', 'poster', 'index')
        or (slug = 'personal' and appearance ->> 'layout' in ('full-bleed', 'portrait-editorial'))
        or (slug = 'event' and appearance ->> 'layout' in ('event-poster', 'conference-card'))
        or (slug = 'business' and appearance ->> 'layout' in ('structured', 'editorial-business'))
      )
      and appearance ->> 'imageTreatment' in ('full-bleed', 'portrait', 'compact', 'frame')
      and (not (appearance ? 'qrStyle') or (jsonb_typeof(appearance -> 'qrStyle') = 'string'
        and appearance ->> 'qrStyle' in ('standard', 'accent-frame', 'label', 'inverse', 'rounded')))
      and (not (appearance ? 'intensity') or (jsonb_typeof(appearance -> 'intensity') = 'string'
        and appearance ->> 'intensity' in ('quiet', 'balanced', 'signal')))
      and (not (appearance ? 'card') or (jsonb_typeof(appearance -> 'card') = 'string'
        and appearance ->> 'card' in ('flat', 'outline', 'soft', 'layered', 'editorial')))
      and (not (appearance ? 'radius') or (jsonb_typeof(appearance -> 'radius') = 'string'
        and appearance ->> 'radius' in ('sharp', 'subtle', 'soft')))
      and (not (appearance ? 'button') or (jsonb_typeof(appearance -> 'button') = 'string'
        and appearance ->> 'button' in ('pill', 'block', 'editorial', 'minimal')))
      and (not (appearance ? 'links') or (jsonb_typeof(appearance -> 'links') = 'string'
        and appearance ->> 'links' in ('icons', 'list', 'chips', 'cards')))
      and (not (appearance ? 'soundStyle') or (jsonb_typeof(appearance -> 'soundStyle') = 'string'
        and appearance ->> 'soundStyle' in ('core', 'strip', 'disc', 'poster')))
    );

comment on constraint profile_modes_appearance_check on public.profile_modes is
  'Curated per-Mode appearance ids only (no CSS). Plan access is resolved server-side; premium values survive downgrade.';

-- Whether a saved appearance value is above Free. Mirrors capabilityForField() in
-- src/components/profile/appearance.ts.
create or replace function private.appearance_value_is_premium(p_field text, p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then false
    when p_field = 'theme' then p_value #>> '{}' not in ('light', 'dark')
    when p_field = 'layout' then p_value #>> '{}' in ('portrait', 'poster', 'index')
    when p_field = 'imageTreatment' then p_value #>> '{}' = 'frame'
    when p_field = 'intensity' then p_value #>> '{}' <> 'balanced'
    when p_field in ('card', 'radius', 'button', 'links') then true
    when p_field = 'soundStyle' then p_value #>> '{}' <> 'core'
    when p_field = 'qrStyle' then p_value #>> '{}' <> 'standard'
    else false
  end
$$;

create or replace function private.enforce_profile_mode_appearance_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  field text;
  introduced boolean := false;
begin
  -- Server-side jobs (service role, migrations) are trusted; members' own writes are checked.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  foreach field in array array['theme', 'layout', 'imageTreatment', 'intensity', 'card', 'radius', 'button', 'links', 'soundStyle', 'qrStyle'] loop
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
$$;

revoke all on function private.appearance_value_is_premium(text, jsonb) from public, anon, authenticated;
revoke all on function private.enforce_profile_mode_appearance_plan() from public, anon, authenticated;

create trigger profile_modes_appearance_plan
  before insert or update of appearance on public.profile_modes
  for each row execute function private.enforce_profile_mode_appearance_plan();

comment on function private.enforce_profile_mode_appearance_plan() is
  'Refuses newly introduced premium appearance values for accounts without active Plus/Pro. Unchanged saved values pass, so downgrades never delete configuration.';
