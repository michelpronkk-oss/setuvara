-- Tile sizes and hidden entries for a Mode's page, kept with its order and read and written under
-- the page order's existing policies.
--   sizes:  { "<page order key>": "small" | "hero" }. Wide is the default and is never stored.
--   hidden: Actions, projects and Mode sections the owner switched off for this page. Blocks and
--           links keep their own visibility; an Action keeps its status, a project its Builder state.
alter table public.mode_page_order
  add column sizes jsonb not null default '{}'::jsonb
    constraint mode_page_order_sizes_shape check (
      jsonb_typeof(sizes) = 'object'
      and pg_catalog.octet_length(sizes::text) <= 8192
      and not jsonb_path_exists(sizes, '$.* ? (@.type() != "string" || (@ != "small" && @ != "hero"))')
    ),
  add column hidden text[] not null default '{}'
    constraint mode_page_order_hidden_shape check (
      cardinality(hidden) <= 300
      and pg_catalog.array_to_string(hidden, ',') ~ '^(((action|project):[0-9a-f-]{36}|section:(testimonials|creator|audience))(,|$))*$'
    );
