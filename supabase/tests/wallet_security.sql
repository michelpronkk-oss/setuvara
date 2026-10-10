begin;
select plan(14);

select has_table('public', 'wallet_passes', 'Wallet pass registry exists');
select has_table('public', 'apple_wallet_registrations', 'Apple device registrations exist');

select ok((
  select relrowsecurity
  from pg_catalog.pg_class
  where oid = 'public.wallet_passes'::regclass
), 'Wallet pass registry has RLS enabled');
select ok((
  select relrowsecurity
  from pg_catalog.pg_class
  where oid = 'public.apple_wallet_registrations'::regclass
), 'Apple registrations have RLS enabled');

select ok(not has_table_privilege('anon', 'public.wallet_passes', 'SELECT'), 'anon cannot select wallet pass identifiers');
select ok(not has_table_privilege('anon', 'public.wallet_passes', 'INSERT,UPDATE,DELETE'), 'anon cannot mutate wallet passes');
select ok(not has_table_privilege('authenticated', 'public.wallet_passes', 'SELECT'), 'authenticated users cannot read wallet provider state');
select ok(not has_table_privilege('authenticated', 'public.wallet_passes', 'INSERT,UPDATE,DELETE'), 'authenticated users cannot mutate wallet provider state');
select ok(not has_table_privilege('anon', 'public.apple_wallet_registrations', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access Apple registrations');
select ok(not has_table_privilege('authenticated', 'public.apple_wallet_registrations', 'SELECT,INSERT,UPDATE,DELETE'), 'authenticated users cannot access Apple registrations');
select ok(has_table_privilege('service_role', 'public.wallet_passes', 'SELECT,INSERT,UPDATE,DELETE'), 'server service role can manage wallet passes');
select ok(has_table_privilege('service_role', 'public.apple_wallet_registrations', 'SELECT,INSERT,UPDATE,DELETE'), 'server service role can manage Apple registrations');

select ok(not has_function_privilege('anon', 'private.touch_wallet_pass_content()', 'EXECUTE'), 'anon cannot call the private update trigger function');
select ok(not has_function_privilege('authenticated', 'private.touch_wallet_pass_content()', 'EXECUTE'), 'authenticated users cannot call the private update trigger function');

select * from finish();
rollback;
