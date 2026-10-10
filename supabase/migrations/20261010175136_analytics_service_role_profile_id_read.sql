-- Analytics resolves the authenticated owner's canonical profile ID server-side.
-- Grant only that column so the admin client cannot read profile content here.
revoke select on table public.profiles from service_role;
grant select (id) on table public.profiles to service_role;
