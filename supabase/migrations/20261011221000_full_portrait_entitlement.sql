-- Extend the existing Appearance entitlement guard to Full Portrait and its
-- curated controls. Existing premium values survive a downgrade unchanged.
-- RLS, grants, tables and existing rows are untouched.
create or replace function private.appearance_value_is_premium(p_field text, p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or p_value = 'null'::jsonb then false
    when p_field = 'theme' then p_value #>> '{}' not in ('light', 'dark')
    when p_field = 'layout' then p_value #>> '{}' in ('portrait', 'poster', 'index', 'full-portrait')
    when p_field in ('portraitZoom', 'portraitNameSize', 'portraitShowUsername') then true
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
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;

  foreach field in array array['theme', 'layout', 'portraitZoom', 'portraitNameSize', 'portraitShowUsername', 'imageTreatment', 'intensity', 'card', 'radius', 'button', 'links', 'soundStyle', 'qrStyle'] loop
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

comment on function private.enforce_profile_mode_appearance_plan() is
  'Refuses newly introduced premium appearance values, including Full Portrait and its controls, for accounts without active Plus/Pro. Unchanged saved values pass.';
