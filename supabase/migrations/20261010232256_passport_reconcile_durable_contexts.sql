-- Repair/replay only context stamps backed by durable Connection records.
-- This upsert is safe to repeat and intentionally never deletes earned stamps.
with source_context as (
  select connections.user_id as user_id,
         encounter.event_name as event_name,
         encounter.city as city,
         encounter.country_code as country_code,
         encounter.created_at as earned_at
  from public.connections
  join public.connection_encounters encounter on encounter.connection_id = connections.id
  union all
  select connections.connected_user_id,
         encounter.event_name,
         encounter.city,
         encounter.country_code,
         encounter.created_at
  from public.connections
  join public.connection_encounters encounter on encounter.connection_id = connections.id
  where connections.connected_user_id is not null
  union all
  select context.user_id,
         context.event_label,
         context.city,
         context.country_code,
         coalesce(encounter.created_at, context.created_at)
  from public.encounter_context context
  left join public.connection_encounters encounter on encounter.id = context.encounter_id
)
select private.add_passport_context_stamps(
  source_context.user_id,
  source_context.event_name,
  source_context.city,
  source_context.country_code,
  source_context.earned_at
)
from source_context
where source_context.user_id is not null;
