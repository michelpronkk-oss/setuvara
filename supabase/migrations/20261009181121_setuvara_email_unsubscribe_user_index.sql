create index email_unsubscribe_tokens_user_id_idx
  on private.email_unsubscribe_tokens(user_id);

comment on function public.apply_email_unsubscribe(text) is
  'Intentional SECURITY DEFINER endpoint for anonymous one-click unsubscribe. It accepts only a 256-bit opaque single-use token scoped to one optional email category, exposes only a boolean result, and uses an empty search_path with schema-qualified objects.';
