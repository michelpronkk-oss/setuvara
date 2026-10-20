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
    <nav aria-label="Commerce" className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:mb-8 [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] p-1">
      {TABS.map((tab) => {
        const on = tab.href === "/app/identity/creator/commerce" ? pathname === tab.href : pathname.startsWith(tab.href);
        const count = attention[tab.label] ?? 0;
        return (
          <Link aria-current={on ? "page" : undefined} className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition focus-visible:outline-2 ${on ? "bg-white text-[#0D0D0D] shadow-[0_1px_2px_rgba(13,13,13,.08),0_6px_16px_-10px_rgba(13,13,13,.35)]" : "text-black/55 hover:text-black"}`} href={tab.href} key={tab.label}>
            {tab.label}
            {count > 0 && <span aria-label={`${count} need attention`} className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF5A4F] px-1 text-[10px] font-bold text-[#0D0D0D]">{count}</span>}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
