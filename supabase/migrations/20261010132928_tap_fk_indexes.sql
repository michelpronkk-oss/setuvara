-- Cover Tap foreign-key lookups and cascades flagged by the hosted advisor.
create index if not exists equipped_share_states_profile_mode_idx
  on public.equipped_share_states (profile_id, mode_id);

create index if not exists connection_share_grants_profile_tap_device_idx
  on public.connection_share_grants (profile_id, tap_device_id)
  where tap_device_id is not null;

create index if not exists tap_events_owner_device_idx
  on public.tap_events (owner_profile_id, tap_device_id);
