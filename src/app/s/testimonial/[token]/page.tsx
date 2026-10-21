import type { Metadata } from "next";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { TestimonialForm } from "@/components/business/testimonial-form";
import { TOKEN } from "@/lib/business/testimonials";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "A few words · Setuvara", robots: { index: false, follow: false } };

/**
 * The page a client opens from a business's private link. It shows who asked and takes their words
 * once; nothing is public until the business approves it.
 */
export default async function TestimonialInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = TOKEN.test(token);
  const supabase = await createClient();
  const { data } = valid ? await supabase.rpc("get_testimonial_request", { p_token: token }) : { data: null };
  const request = data as { name: string; owner_name: string; owner_username: string; company: string } | null;
  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] px-5 pb-16 pt-10 font-brand text-[#0D0D0D] md:pt-20`}>
      <div className="mx-auto w-full max-w-[560px]">
        <p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/50">Setuvara · Testimonial</p>
        {request ? <TestimonialForm initialName={request.name} owner={request.owner_name} token={token} /> : (
          <>
            <h1 className="mt-4 font-display text-[44px] font-bold leading-[0.95] tracking-[-0.05em]">This link has been used or has ended.</h1>
            <p className="mt-4 text-[16px] leading-[1.5] text-black/60">Each link works once, for 30 days. If you still want to write something, ask for a new link.</p>
          </>
        )}
      </div>
    </main>
  );
}
