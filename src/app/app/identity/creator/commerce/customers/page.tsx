import type { Metadata } from "next";

import { shortDay } from "@/components/commerce/ui";
import { EmptyState, Mono, StudioHead } from "@/components/creator/studio-ui";
import { customersOf, formatAmount } from "@/lib/commerce/model";
import { loadCommerce } from "@/lib/commerce/studio-server";

export const metadata: Metadata = { title: "Customers · Commerce · Setuvara" };

/** People who bought or claimed something, grouped by email. Only what checkout collected; nothing else. */
export default async function CommerceCustomersPage() {
  const commerce = await loadCommerce("/app/identity/creator/commerce/customers");
  if (!commerce.ready || !("seller" in commerce)) return null;
  const customers = customersOf(commerce.orders);
  return (
    <div>
      <StudioHead creator sub={`${customers.length} ${customers.length === 1 ? "person" : "people"}`} title="Customers" />
      {customers.length === 0 ? <EmptyState body="Buyers and free-download claims show here with what they got from you." title="No customers yet." /> : (
        <div className="overflow-x-auto rounded-[22px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
          <table className="w-full min-w-[640px] text-left text-[15px]" data-customers>
            <thead><tr className="border-b border-black/10">{["Customer", "Orders", "Spent", "First", "Last"].map((head) => <th className="px-5 py-3" key={head} scope="col"><Mono className="text-black/50">{head}</Mono></th>)}</tr></thead>
            <tbody className="divide-y divide-black/10">
              {customers.map((customer) => (
                <tr key={customer.email}>
                  <td className="px-5 py-3"><span className="block font-semibold">{customer.name ?? customer.email}</span>{customer.name && <span className="block text-[13px] text-black/55">{customer.email}</span>}</td>
                  <td className="px-5 py-3 tabular-nums">{customer.orders}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{customer.spent.map((item) => formatAmount(item.amount, item.currency)).join(" · ") || "Free"}</td>
                  <td className="px-5 py-3 text-black/65">{shortDay(customer.firstAt)}</td>
                  <td className="px-5 py-3 text-black/65">{shortDay(customer.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 max-w-[60ch] text-[13px] leading-[1.5] text-black/55">You&apos;re the seller, so you look after these details. Use them for this order and for receipts; ask before adding anyone to a mailing list.</p>
    </div>
  );
}
