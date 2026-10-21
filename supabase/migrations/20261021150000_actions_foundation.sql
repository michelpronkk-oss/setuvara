-- Actions 2.0 foundation, shared by every Action kind.
--
--   1. Scheduling: an Action can stay off the page until it opens and leave it once it closes.
--      Dates already gate submissions; this decides whether the card shows meanwhile.
--   2. Insights: daily counts of card views and page opens per Action. Counts only: no visitor
--      id, IP or cookie is stored. Responses and confirmations come from the submissions.
--   3. Thank-you and reward: the owner's own success heading, and a link or code revealed only
--      after a real submission (or after confirming, for Newsletters and Giveaways). Rewards
--      never appear in the public config.

-- Plan limits for the new parts.
alter table private.action_plan_limits add column if not exists insights_days integer not null default 7 check (insights_days between 1 and 400);
alter table private.action_plan_limits add column if not exists can_reward boolean not null default false;
update private.action_plan_limits set insights_days = case plan_code when 'free' then 7 when 'plus' then 90 else 365 end,
  can_reward = plan_code <> 'free';

create or replace function public.my_action_limits()
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('plan',l.plan_code,'published_actions',l.published_actions,'open_giveaways',l.open_giveaways,
    'custom_questions',l.custom_questions,'can_export',l.can_export,'insights_days',l.insights_days,'can_reward',l.can_reward)
  from private.action_plan_limits l where l.plan_code=private.member_plan(auth.uid())
$function$;
revoke all on function public.my_action_limits() from public, anon;
grant execute on function public.my_action_limits() to authenticated;

-- 1. Scheduling.
alter table public.profile_actions add column if not exists show_before_start boolean not null default true;
alter table public.profile_actions add column if not exists show_after_end boolean not null default true;

create or replace function public.get_public_profile_actions(p_username text, p_mode text)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'kind',a.kind,'title',a.title,'intro',a.intro,'cta_label',a.cta_label,
      'cover_block_id',a.cover_block_id,'config',a.config,'starts_at',a.starts_at,'ends_at',a.ends_at)
    order by a.sort_order, a.created_at), '[]'::jsonb)
  from public.profiles p
  join public.profile_modes m on m.profile_id=p.id and m.slug=p_mode and m.is_enabled
  join public.profile_actions a on a.mode_id=m.id and a.status='published'
  where p.username=pg_catalog.lower(pg_catalog.btrim(p_username)) and p.is_published
    and (a.show_before_start or a.starts_at is null or a.starts_at <= pg_catalog.now())
    and (a.show_after_end or a.ends_at is null or a.ends_at > pg_catalog.now())
$function$;
revoke all on function public.get_public_profile_actions(text,text) from public;
grant execute on function public.get_public_profile_actions(text,text) to anon, authenticated, service_role;

-- 2. Insights.
create table if not exists public.action_daily_stats (
  action_id uuid not null references public.profile_actions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  opens integer not null default 0 check (opens >= 0),
  primary key (action_id, day)
);
create index if not exists action_daily_stats_owner_idx on public.action_daily_stats (profile_id, day);
alter table public.action_daily_stats enable row level security;
revoke all on public.action_daily_stats from public, anon, authenticated;
grant all on public.action_daily_stats to service_role;

-- Counts a view of the cards or an open of an Action's page. Only live Actions on live pages
-- count, and never the owner looking at their own.
create or replace function public.record_action_event(p_action_ids uuid[], p_kind text, p_viewer uuid)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_count integer;
begin
  if p_kind not in ('view','open') or cardinality(p_action_ids) > 24 then raise exception using errcode='22023', message='invalid_event'; end if;
  insert into public.action_daily_stats as d (action_id, profile_id, day, views, opens)
  select a.id, a.profile_id, (pg_catalog.statement_timestamp() at time zone 'UTC')::date,
    case when p_kind='view' then 1 else 0 end, case when p_kind='open' then 1 else 0 end
  from public.profile_actions a
  join public.profile_modes m on m.id=a.mode_id and m.is_enabled
  join public.profiles p on p.id=a.profile_id and p.is_published
  where a.id = any(p_action_ids) and a.status='published' and a.profile_id is distinct from p_viewer
  on conflict (action_id, day) do update set views=d.views+excluded.views, opens=d.opens+excluded.opens;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
revoke all on function public.record_action_event(uuid[],text,uuid) from public, anon, authenticated;
grant execute on function public.record_action_event(uuid[],text,uuid) to service_role;

-- The owner's numbers: per Action totals over the window the plan allows, and one Action's days.
create or replace function public.my_action_insights(p_days integer default 30, p_action_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $function$
  with lim as (
    select least(greatest(coalesce(p_days,30),1), l.insights_days) as days, l.insights_days as plan_days
    from private.action_plan_limits l where l.plan_code=private.member_plan(auth.uid())
  ), win as (
    select (pg_catalog.statement_timestamp() at time zone 'UTC')::date - (lim.days - 1) as since, lim.days, lim.plan_days from lim
  ), mine as (
    select a.id, a.kind from public.profile_actions a where a.profile_id=auth.uid() and (p_action_id is null or a.id=p_action_id)
  ), seen as (
    select s.action_id, sum(s.views) views, sum(s.opens) opens from public.action_daily_stats s, win
    where s.profile_id=auth.uid() and s.day >= win.since and s.action_id in (select id from mine) group by s.action_id
  ), sent as (
    select s.action_id,
      count(*) filter (where s.status not in ('spam') and (s.created_at at time zone 'UTC')::date >= win.since) responses,
      count(*) filter (where s.verified_at is not null and (s.verified_at at time zone 'UTC')::date >= win.since) confirmed
    from public.action_submissions s, win
    where s.profile_id=auth.uid() and s.action_id in (select id from mine) group by s.action_id
  )
  select jsonb_build_object('days',win.days,'plan_days',win.plan_days,
    'actions',coalesce((select jsonb_agg(jsonb_build_object('id',mine.id,
        'views',coalesce(seen.views,0),'opens',coalesce(seen.opens,0),'responses',coalesce(sent.responses,0),
        'confirmed',case when mine.kind in ('giveaway','newsletter') then coalesce(sent.confirmed,0) else coalesce(sent.responses,0) end))
      from mine left join seen on seen.action_id=mine.id left join sent on sent.action_id=mine.id), '[]'::jsonb),
    'daily',case when p_action_id is null then null else (
      select jsonb_agg(jsonb_build_object('day',d.day,
          'views',coalesce((select s.views from public.action_daily_stats s where s.action_id=p_action_id and s.profile_id=auth.uid() and s.day=d.day),0),
          'opens',coalesce((select s.opens from public.action_daily_stats s where s.action_id=p_action_id and s.profile_id=auth.uid() and s.day=d.day),0),
          'responses',(select count(*) from public.action_submissions x where x.action_id=p_action_id and x.profile_id=auth.uid()
            and x.status <> 'spam' and (x.created_at at time zone 'UTC')::date=d.day)) order by d.day)
      from (select pg_catalog.generate_series(win.since, (pg_catalog.statement_timestamp() at time zone 'UTC')::date, interval '1 day')::date as day) d) end)
  from win
$function$;
revoke all on function public.my_action_insights(integer,uuid) from public, anon;
grant execute on function public.my_action_insights(integer,uuid) to authenticated;

-- 3. Thank-you and reward, one row per Action, read and written only by its owner.
create table if not exists public.action_thanks (
  action_id uuid primary key references public.profile_actions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  heading text not null default '' check (char_length(heading) <= 60),
  reward_kind text not null default 'none' check (reward_kind in ('none','link','code')),
  reward_label text not null default '' check (char_length(reward_label) <= 60),
  reward_url text check (reward_url is null or (char_length(reward_url) <= 2048 and reward_url ~ '^https://[^\s]+$')),
  reward_code text check (reward_code is null or char_length(reward_code) between 1 and 80),
  updated_at timestamptz not null default pg_catalog.statement_timestamp(),
  check (reward_kind <> 'link' or reward_url is not null),
  check (reward_kind <> 'code' or reward_code is not null)
);

create or replace function private.validate_action_thanks() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if not exists(select 1 from public.profile_actions a where a.id=new.action_id and a.profile_id=new.profile_id) then
    raise exception using errcode='23514', message='action_thanks_mismatch';
  end if;
  if tg_op='UPDATE' and (new.action_id <> old.action_id or new.profile_id <> old.profile_id) then
    raise exception using errcode='23514', message='action_thanks_mismatch';
  end if;
  -- A reward is a plan feature; an existing one simply stops showing after a downgrade.
  if new.reward_kind <> 'none' and coalesce(auth.role(),'') in ('authenticated','anon')
     and (tg_op='INSERT' or new.reward_kind is distinct from old.reward_kind or new.reward_url is distinct from old.reward_url or new.reward_code is distinct from old.reward_code)
     and not (select l.can_reward from private.action_plan_limits l where l.plan_code=private.member_plan(new.profile_id)) then
    raise exception using errcode='P0001', message='plan_reward_unavailable';
  end if;
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$function$;
revoke all on function private.validate_action_thanks() from public, anon, authenticated;
drop trigger if exists action_thanks_validate on public.action_thanks;
create trigger action_thanks_validate before insert or update on public.action_thanks
  for each row execute function private.validate_action_thanks();

alter table public.action_thanks enable row level security;
revoke all on public.action_thanks from public, anon, authenticated;
grant select, insert, update, delete on public.action_thanks to authenticated;
grant all on public.action_thanks to service_role;
drop policy if exists action_thanks_owner_all on public.action_thanks;
create policy action_thanks_owner_all on public.action_thanks for all to authenticated
  using (profile_id=(select auth.uid())) with check (profile_id=(select auth.uid()));

-- What a visitor sees after a real submission. The server calls it only after the submit or
-- confirm function accepted them; the reward is left out when the owner's plan doesn't include it.
create or replace function public.action_thanks_for(p_action_id uuid)
returns jsonb language sql stable security definer set search_path='' as $function$
  select jsonb_build_object('heading',t.heading,
    'reward',case when t.reward_kind='none' or not (select l.can_reward from private.action_plan_limits l where l.plan_code=private.member_plan(t.profile_id))
      then null else jsonb_build_object('kind',t.reward_kind,'label',t.reward_label,'url',t.reward_url,'code',t.reward_code) end)
  from public.action_thanks t where t.action_id=p_action_id
$function$;
revoke all on function public.action_thanks_for(uuid) from public, anon, authenticated;
grant execute on function public.action_thanks_for(uuid) to service_role;
