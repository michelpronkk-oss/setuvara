-- The Embed block: a booking page, form or newsletter sign-up from an approved provider, shown in
-- place on the profile (lib/blocks/embeds.ts holds the list). Embeds are a Plus and Pro block:
-- members' own writes that add one or change its link need an active membership. A saved embed
-- survives a downgrade and shows as a plain link card.
alter table public.profile_blocks
  drop constraint profile_blocks_kind_check,
  add constraint profile_blocks_kind_check check (kind = any (array[
    'video', 'music', 'feature', 'services', 'highlights', 'testimonial', 'image',
    'text', 'section', 'faq', 'location', 'countdown', 'embed'
  ]));

create or replace function private.enforce_profile_block_plan()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  -- Server-side jobs (service role, migrations) are trusted; members' own writes are checked.
  if coalesce(auth.role(), '') not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.kind <> 'embed'
    or (tg_op = 'UPDATE' and old.kind = 'embed' and (old.data -> 'url') is not distinct from (new.data -> 'url')) then
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

  raise exception 'block_requires_plus'
    using errcode = 'P0001',
      hint = 'Embeds need an active Setuvara Plus or Pro membership. Saved embeds are kept.';
end;
$function$;

revoke all on function private.enforce_profile_block_plan() from public, anon, authenticated;

create trigger profile_blocks_enforce_plan
before insert or update on public.profile_blocks
for each row execute function private.enforce_profile_block_plan();
