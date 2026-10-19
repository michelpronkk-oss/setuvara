import Link from "next/link";

import { buttonClass } from "@/components/admin/ui";

export default function AdminNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="text-center">
        <p className="font-label text-[11px] font-medium uppercase tracking-[0.2em] text-coral">404</p>
        <h1 className="mt-4 font-display text-[56px] font-extrabold leading-[0.9] tracking-[-0.06em] sm:text-[80px]">Nothing here<span className="text-coral">.</span></h1>
        <Link className={`${buttonClass("primary", "md")} mt-8`} href="/">Back to overview <span aria-hidden="true">→</span></Link>
      </div>
    </main>
  );
}
