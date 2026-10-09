-- Keep Passport reward lookups indexed and consolidate equivalent read policies.
create index if not exists passport_entitlements_reward_id_idx
  on public.passport_entitlements(reward_id);
create index if not exists passport_preferences_reward_id_idx
  on public.passport_preferences(reward_id);

drop policy if exists "users read own passport preferences" on public.passport_preferences;
drop policy if exists "public can read chosen public cosmetics" on public.passport_preferences;
create policy "users read own or public passport cosmetics"
  on public.passport_preferences
  for select
  to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or (
      category in ('profile_treatment','accent','profile_mark')
      and exists (
        select 1
        from public.profiles
        where profiles.id = passport_preferences.user_id
          and profiles.is_published
      )
    )
  );

comment on function public.set_passport_reward(text,text) is
  'Intentional SECURITY DEFINER owner RPC; auth.uid() binds writes to the caller and reward entitlement is checked before selection.';
comment on function public.ack_passport_milestone(integer) is
  'Intentional SECURITY DEFINER owner RPC; auth.uid() binds acknowledgement to the caller and only unseen earned milestones are updated.';
