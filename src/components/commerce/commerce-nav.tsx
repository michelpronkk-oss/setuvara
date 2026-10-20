"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/app/identity/creator/commerce" },
  { label: "Products", href: "/app/identity/creator/commerce/products" },
  { label: "Orders", href: "/app/identity/creator/commerce/orders" },
  { label: "Customers", href: "/app/identity/creator/commerce/customers" },
  { label: "Analytics", href: "/app/identity/creator/commerce/analytics" },
  { label: "Payments", href: "/app/identity/creator/commerce/payments" },
] as const;

/** The Commerce workspace's own row, under the Creator studio tabs. */
export function CommerceNav({ attention }: { attention: Partial<Record<(typeof TABS)[number]["label"], number>> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Commerce" className="-mx-3.5 mb-6 flex items-center gap-5 overflow-x-auto border-b border-black/10 px-3.5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const on = tab.href === "/app/identity/creator/commerce" ? pathname === tab.href : pathname.startsWith(tab.href);
        const count = attention[tab.label] ?? 0;
        return (
          <Link aria-current={on ? "page" : undefined} className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[15px] font-semibold focus-visible:outline-2 ${on ? "text-[#0D0D0D] after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-[#0D0D0D]" : "text-black/55 hover:text-black"}`} href={tab.href} key={tab.label}>
            {tab.label}
            {count > 0 && <span aria-label={`${count} need attention`} className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[10px] font-bold text-[#0D0D0D]">{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
