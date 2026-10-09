alter table public.profiles
  add constraint profiles_username_not_reserved
  check (
    lower(username) not in (
      'app', 'login', 'signup', 'auth', 'api', 'pricing', 'about', 'help',
      'teams', 'events', 'security', 'privacy', 'terms', 'settings', 'account',
      'share', 'connections', 'wallet', 'admin', 'support', 'contact', 'careers',
      'brand', 'status', 'u', '_next', 'next', 'favicon', 'icon', 'robots',
      'sitemap', 'manifest', 'apple-touch-icon', 'assets', 'static', 'images',
      'fonts', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json'
    )
  );

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    lower(btrim(coalesce(candidate_username, ''))) ~ '^[a-z0-9_]{3,24}$'
    and lower(btrim(coalesce(candidate_username, ''))) not in (
      'app', 'login', 'signup', 'auth', 'api', 'pricing', 'about', 'help',
      'teams', 'events', 'security', 'privacy', 'terms', 'settings', 'account',
      'share', 'connections', 'wallet', 'admin', 'support', 'contact', 'careers',
      'brand', 'status', 'u', '_next', 'next', 'favicon', 'icon', 'robots',
      'sitemap', 'manifest', 'apple-touch-icon', 'assets', 'static', 'images',
      'fonts', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'manifest.json'
    )
    and not exists (
      select 1
      from public.profiles
      where username = lower(btrim(coalesce(candidate_username, '')))
    );
$function$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
