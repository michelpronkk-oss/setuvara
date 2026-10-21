-- Creator Commerce: a paid order unlocks what it bought.
--
-- Content rules can lock a Work piece behind a one-time offer (access_level 'purchase'), and
-- can_view_creator_block checks creator_access_grants for it, but nothing ever wrote a grant: a
-- buyer paid and the piece stayed locked. Now the order's move to paid writes the grant, once, in
-- the same transaction that records the payment. Refunds and chargebacks already end access
-- (can_view_creator_block checks the order status), so nothing is revoked here. Guest orders
-- without an account have no one to grant to and are left alone.

create function private.grant_purchase_access() returns trigger language plpgsql security definer set search_path='' as $function$
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') and new.buyer_user_id is not null
     and not exists(select 1 from public.creator_access_grants g where g.order_id = new.id and g.profile_block_id is null) then
    insert into public.creator_access_grants (creator_user_id, user_id, offer_id, source, order_id)
    values (new.creator_user_id, new.buyer_user_id, new.offer_id, 'purchase', new.id);
  end if;
  return null;
end;
$function$;
revoke all on function private.grant_purchase_access() from public, anon, authenticated;
create trigger creator_orders_grant_access after insert or update of status on public.creator_orders
  for each row execute function private.grant_purchase_access();

-- Orders already paid get their grant now.
insert into public.creator_access_grants (creator_user_id, user_id, offer_id, source, order_id)
select o.creator_user_id, o.buyer_user_id, o.offer_id, 'purchase', o.id
from public.creator_orders o
where o.status = 'paid' and o.buyer_user_id is not null
  and not exists(select 1 from public.creator_access_grants g where g.order_id = o.id and g.profile_block_id is null);
