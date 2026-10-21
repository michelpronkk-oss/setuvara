-- Creator Mode 2.0, slice 2: the giveaway winner picker. It works for a Giveaway on any Mode.
--
-- A draw happens on the server, after the giveaway ends, among confirmed entries only. The seed
-- is 32 bytes from gen_random_bytes. Each eligible entry is ranked by sha256(seed || entry id) and
-- the lowest ranks win, so a draw is reproducible by anyone holding the seed and the list, and
-- nobody can steer it: the seed is unknown until the draw has already been saved. The record keeps
-- the seed, how many entries were eligible and a digest of exactly which ones.
-- A redraw (say a winner never replied) records why, and leaves out earlier winners and anyone
-- disqualified. The owner announces a draw when ready; the public sees first name and initial.

create table public.action_giveaway_draws (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.profile_actions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  draw_number integer not null check (draw_number between 1 and 50),
  winners_requested integer not null check (winners_requested between 1 and 10),
  eligible_count integer not null check (eligible_count >= 0),
  eligible_digest text not null check (eligible_digest ~ '^[0-9a-f]{64}$'),
  seed text not null check (seed ~ '^[0-9a-f]{64}$'),
  winner_submission_ids uuid[] not null,
  reason text check (reason is null or char_length(reason) between 1 and 200),
  announced_at timestamptz,
  announced_names text[],
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  unique (action_id, draw_number),
  check (draw_number = 1 or reason is not null),
  check ((announced_at is null) = (announced_names is null))
);
create index action_giveaway_draws_owner_idx on public.action_giveaway_draws (profile_id, created_at desc);
alter table public.action_giveaway_draws enable row level security;
revoke all on public.action_giveaway_draws from public, anon, authenticated;
grant select on public.action_giveaway_draws to authenticated;
grant all on public.action_giveaway_draws to service_role;
create policy action_giveaway_draws_owner_read on public.action_giveaway_draws for select to authenticated
  using (profile_id = (select auth.uid()));

-- The rank of one entry in a draw. Public knowledge: it is how anyone checks a draw.
create function public.giveaway_draw_rank(p_seed text, p_submission_id uuid)
returns text language sql immutable set search_path='' as $function$
  select pg_catalog.encode(extensions.digest(p_seed || ':' || p_submission_id::text, 'sha256'), 'hex')
$function$;
grant execute on function public.giveaway_draw_rank(text, uuid) to anon, authenticated, service_role;

-- Draw winners. Owner only, after the end, among confirmed entries that haven't won before.
create function public.draw_giveaway_winners(p_action_id uuid, p_winners integer default 1, p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  a public.profile_actions;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_number integer;
  v_seed text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_ids uuid[];
  v_winners uuid[];
  v_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  if p_winners is null or p_winners not between 1 and 10 then raise exception using errcode='22023', message='invalid_winners'; end if;
  select * into a from public.profile_actions where id = p_action_id and profile_id = auth.uid() and kind = 'giveaway' for update;
  if not found then raise exception using errcode='P0002', message='giveaway_not_found'; end if;
  if a.ends_at is null or a.ends_at > pg_catalog.statement_timestamp() then raise exception using errcode='P0001', message='giveaway_not_ended'; end if;
  select coalesce(max(d.draw_number), 0) + 1 into v_number from public.action_giveaway_draws d where d.action_id = a.id;
  if v_number > 1 and (v_reason is null or pg_catalog.char_length(v_reason) > 200) then raise exception using errcode='22023', message='reason_required'; end if;
  if v_number = 1 then v_reason := null; end if;
  if v_number > 50 then raise exception using errcode='P0001', message='too_many_draws'; end if;

  -- Confirmed entries, minus anyone who already won a draw of this giveaway.
  select coalesce(pg_catalog.array_agg(s.id order by s.id), '{}') into v_ids
  from public.action_submissions s
  where s.action_id = a.id and s.status = 'entered' and s.verified_at is not null
    and not exists(select 1 from public.action_giveaway_draws d where d.action_id = a.id and s.id = any(d.winner_submission_ids));
  if pg_catalog.cardinality(v_ids) = 0 then raise exception using errcode='P0001', message='no_eligible_entries'; end if;

  select coalesce(pg_catalog.array_agg(x.id order by public.giveaway_draw_rank(v_seed, x.id), x.id), '{}') into v_winners
  from (select u.id from pg_catalog.unnest(v_ids) u(id) order by public.giveaway_draw_rank(v_seed, u.id), u.id limit p_winners) x;

  insert into public.action_giveaway_draws (action_id, profile_id, draw_number, winners_requested, eligible_count, eligible_digest, seed, winner_submission_ids, reason)
  values (a.id, a.profile_id, v_number, p_winners, pg_catalog.cardinality(v_ids),
    pg_catalog.encode(extensions.digest(pg_catalog.array_to_string(v_ids, ','), 'sha256'), 'hex'), v_seed, v_winners, v_reason)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'draw_number', v_number, 'eligible_count', pg_catalog.cardinality(v_ids), 'winners', pg_catalog.to_jsonb(v_winners));
end;
$function$;

-- Announce a draw (or take the announcement down). Names are fixed at announcement: first name
-- and the initial of the last, so the public record survives the later clean-up of entrant data.
create function public.announce_giveaway_draw(p_draw_id uuid, p_announce boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  d public.action_giveaway_draws;
  v_names text[];
begin
  if auth.uid() is null then raise exception using errcode='42501', message='sign_in_required'; end if;
  select * into d from public.action_giveaway_draws where id = p_draw_id and profile_id = auth.uid() for update;
  if not found then raise exception using errcode='P0002', message='draw_not_found'; end if;
  if not coalesce(p_announce, false) then
    update public.action_giveaway_draws set announced_at = null, announced_names = null where id = d.id;
    return jsonb_build_object('announced', false);
  end if;
  select pg_catalog.array_agg(coalesce(nullif(pg_catalog.btrim(
      pg_catalog.split_part(pg_catalog.btrim(s.name), ' ', 1) || case when pg_catalog.btrim(s.name) ~ '\s'
        then ' ' || pg_catalog.upper(pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(s.name), '^.*\s', ''), 1)) || '.' else '' end), ''), 'A winner')
    order by w.ord)
  into v_names
  from pg_catalog.unnest(d.winner_submission_ids) with ordinality w(id, ord)
  left join public.action_submissions s on s.id = w.id;
  -- Only the newest announced draw is public: announcing one takes down the others.
  update public.action_giveaway_draws set announced_at = null, announced_names = null where action_id = d.action_id and id <> d.id;
  update public.action_giveaway_draws set announced_at = pg_catalog.statement_timestamp(), announced_names = v_names where id = d.id;
  return jsonb_build_object('announced', true, 'names', pg_catalog.to_jsonb(v_names));
end;
$function$;

-- What the public page shows: the announced names and the draw's audit facts, never emails or ids.
create function public.get_giveaway_announcement(p_action_id uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('names', pg_catalog.to_jsonb(d.announced_names), 'announced_at', d.announced_at,
    'eligible_count', d.eligible_count, 'draw_number', d.draw_number, 'drawn_at', d.created_at)
  from public.action_giveaway_draws d
  join public.profile_actions a on a.id = d.action_id and a.status in ('published','closed')
  join public.profile_modes m on m.id = a.mode_id and m.is_enabled
  join public.profiles p on p.id = a.profile_id and p.is_published
  where d.action_id = p_action_id and d.announced_at is not null
  order by d.draw_number desc limit 1
$function$;

revoke all on function public.draw_giveaway_winners(uuid,integer,text), public.announce_giveaway_draw(uuid,boolean) from public, anon;
grant execute on function public.draw_giveaway_winners(uuid,integer,text), public.announce_giveaway_draw(uuid,boolean) to authenticated;
revoke all on function public.get_giveaway_announcement(uuid) from public;
grant execute on function public.get_giveaway_announcement(uuid) to anon, authenticated, service_role;

comment on table public.action_giveaway_draws is 'Auditable giveaway draws: secure seed, eligible count and digest, winners ranked by sha256(seed:id). Owner-read; written by draw_giveaway_winners.';
