-- Connection detail: a viewer's private memory of WHEN an encounter happened,
-- and where each memory value came from.
--
-- encounter_context already holds the viewer-owned city / venue / event for one
-- encounter. It had no date, so a viewer who remembers "we actually met the
-- evening before" could only rewrite nothing. met_on / met_time are the viewer's
-- remembered local calendar date and optional wall-clock time. They never touch
-- connection_encounters.created_at or connections.created_at, which stay the
-- canonical, immutable record of when the Connection was made.
--
-- provenance keeps memory honest for future Smart Where You Met:
--   viewer     the viewer typed or picked it with no Setuvara context to compare
--   confirmed  the viewer kept the context Setuvara already knew for the encounter
--   corrected  the viewer changed context Setuvara already knew
--   suggested  reserved: Setuvara proposed it and the viewer has not confirmed it
-- RLS is unchanged: every encounter_context row is readable and writable only by
-- its owning participant.

alter table public.encounter_context
  add column if not exists met_on date,
  add column if not exists met_time time(0) without time zone,
  add column if not exists provenance text not null default 'viewer';

alter table public.encounter_context
  drop constraint if exists encounter_context_met_on_range,
  drop constraint if exists encounter_context_met_time_needs_date,
  drop constraint if exists encounter_context_provenance_check;

alter table public.encounter_context
  add constraint encounter_context_met_on_range
    check (met_on is null or met_on between date '2000-01-01' and date '2100-12-31'),
  add constraint encounter_context_met_time_needs_date
    check (met_time is null or met_on is not null),
  add constraint encounter_context_provenance_check
    check (provenance in ('viewer', 'confirmed', 'corrected', 'suggested'));

comment on column public.encounter_context.met_on is
  'Viewer-remembered local date of this encounter. Private memory; never rewrites the canonical encounter timestamp.';
comment on column public.encounter_context.met_time is
  'Optional viewer-remembered local time on met_on.';
comment on column public.encounter_context.provenance is
  'Where this private memory came from: viewer, confirmed, corrected, or (future) suggested.';
