import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { isAdminHost } from "@/lib/admin/host";

import { marketingFontClasses } from "../(marketing)/fonts";

export const metadata: Metadata = {
  title: { default: "Setuvara Admin", template: "%s · Setuvara Admin" },
  robots: { index: false, follow: false, nocache: true },
};

/** Reached only through admin.setuvara.com (the proxy rewrites that host into this tree). */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminHost((await headers()).get("host"))) notFound();
  return (
    <div className={`${marketingFontClasses} min-h-dvh bg-paper font-brand text-ink`} data-setuvara-admin="">
      {children}
    </div>
  );
}
