-- Launch-lightweight in-app feedback. Signed-in members send a short note
-- (with an optional screenshot) from the app shell. Submissions are private:
-- a member can add and read only their own rows, and only the service role
-- (Supabase dashboard / SQL editor) can change status or see everyone's.

create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  message text not null,
  screenshot_path text,
  route text,
  mode text,
  plan text,
  user_agent text,
  viewport text,
  locale text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_feedback_kind_check check (kind in ('bug', 'confusing', 'idea', 'other')),
  constraint product_feedback_message_check check (char_length(btrim(message)) between 1 and 4000),
  constraint product_feedback_status_check check (status in ('open', 'reviewing', 'done')),
  constraint product_feedback_mode_check check (mode is null or mode in ('personal', 'event', 'business')),
  constraint product_feedback_plan_check check (plan is null or plan in ('free', 'plus', 'pro')),
  constraint product_feedback_route_check check (route is null or char_length(route) <= 300),
  constraint product_feedback_user_agent_check check (user_agent is null or char_length(user_agent) <= 500),
  constraint product_feedback_viewport_check check (viewport is null or viewport ~ '^[0-9]{2,5}x[0-9]{2,5}(@[0-9.]{1,4})?$'),
  constraint product_feedback_locale_check check (locale is null or char_length(locale) <= 35),
  -- Screenshots live in the member's own folder of the private bucket.
  constraint product_feedback_screenshot_path_check check (
    screenshot_path is null
    or screenshot_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.(png|jpg|webp)$')
  )
);

create index if not exists product_feedback_status_created_idx on public.product_feedback (status, created_at desc);
create index if not exists product_feedback_user_created_idx on public.product_feedback (user_id, created_at desc);

alter table public.product_feedback enable row level security;

-- Members never get UPDATE/DELETE, and status is not insertable, so every
-- member submission starts as 'open'.
revoke all on table public.product_feedback from anon, authenticated;
grant select on table public.product_feedback to authenticated;
grant insert (kind, message, screenshot_path, route, mode, plan, user_agent, viewport, locale)
  on table public.product_feedback to authenticated;
grant all on table public.product_feedback to service_role;

drop policy if exists "Members can send feedback" on public.product_feedback;
create policy "Members can send feedback"
on public.product_feedback for insert
to authenticated
with check (user_id = (select auth.uid()) and status = 'open');

drop policy if exists "Members can read their own feedback" on public.product_feedback;
create policy "Members can read their own feedback"
on public.product_feedback for select
to authenticated
using (user_id = (select auth.uid()));

-- Keeps the table from being used as free storage: at most 10 notes in any
-- ten minutes per member. Service role inserts are not limited.
create or replace function public.product_feedback_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and coalesce(auth.role(), '') <> 'service_role' then
    if (
      select count(*) from public.product_feedback
      where user_id = new.user_id and created_at > now() - interval '10 minutes'
    ) >= 10 then
      raise exception 'feedback_rate_limited' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.product_feedback_before_write() from public, anon, authenticated;

drop trigger if exists product_feedback_before_write on public.product_feedback;
create trigger product_feedback_before_write
before insert or update on public.product_feedback
for each row execute function public.product_feedback_before_write();

-- Private screenshot bucket: owners upload into their own folder; nobody reads
-- through the API except the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-feedback', 'product-feedback', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can upload feedback screenshots" on storage.objects;
create policy "Members can upload feedback screenshots"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-feedback'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'
);
