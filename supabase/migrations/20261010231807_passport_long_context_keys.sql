-- Keep event and city context keys small enough for the Passport unique index,
-- while preserving full names in the human-readable title fields.
create or replace function private.passport_context_stamp_key(
  p_type text,
  p_event text,
  p_city text,
  p_country text
)
returns text
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_event text := private.passport_normalize_context(p_event);
  v_city text := private.passport_normalize_context(p_city);
  v_country text := pg_catalog.upper(pg_catalog.btrim(p_country));
  v_key text;
begin
  if not private.passport_is_iso_country(v_country) then
    v_country := null;
  end if;

  if p_type = 'country' then
    return v_country;
  elsif p_type = 'city' then
    if v_city is null then return null; end if;
    v_key := pg_catalog.concat_ws('|', v_country, pg_catalog.lower(v_city));
  elsif p_type = 'event' then
    if v_event is null then return null; end if;
    v_key := pg_catalog.concat_ws('|', v_country, pg_catalog.lower(v_city), pg_catalog.lower(v_event));
  else
    return null;
  end if;

  if pg_catalog.char_length(v_key) > 120 then
    return pg_catalog.left(v_key, 87) || '|' || pg_catalog.md5(v_key);
  end if;
  return v_key;
end;
$function$;

revoke all on function private.passport_context_stamp_key(text, text, text, text) from public, anon, authenticated;
