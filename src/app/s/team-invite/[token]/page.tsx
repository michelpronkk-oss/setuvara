import type { Metadata } from "next";
import Link from "next/link";

import { marketingFontClasses } from "@/app/(marketing)/fonts";
import { switchAccountForInvite } from "@/app/app/identity/team/actions";
import { AcceptInvite } from "@/components/business/accept-invite";
import { inkButton, lineButton } from "@/components/creator/studio-ui";
import { invitePath, ROLE_LABEL, ROLE_NOTE, TOKEN, type Invite } from "@/lib/business/team";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a team · Setuvara", robots: { index: false, follow: false } };

/**
 * The page a teammate opens from an owner's invite. It shows who is asking and for which email;
 * accepting needs that email, confirmed and signed in. The database checks it all again.
 */
export default async function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = TOKEN.test(token);
  const supabase = await createClient();
  const [{ data }, { data: claims }] = await Promise.all([
    valid ? supabase.rpc("get_business_invite", { p_token: token }) : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);
  const invite = data as Invite | null;
  const email = typeof claims?.claims?.email === "string" ? claims.claims.email : null;
  const signedIn = typeof claims?.claims?.sub === "string";
  const matches = Boolean(invite && email && email.toLowerCase() === invite.email.toLowerCase());
  const next = `/login?next=${encodeURIComponent(invitePath(token))}`;
  const business = invite ? invite.company || invite.business_name : "";

  return (
    <main className={`${marketingFontClasses} min-h-dvh bg-[#F5F4EF] px-5 pb-16 pt-10 font-brand text-[#0D0D0D] md:pt-20`}>
      <div className="mx-auto w-full max-w-[560px]">
        <p className="font-label text-[11px] uppercase tracking-[0.18em] text-black/50">Setuvara · Team invite</p>
        {!invite ? (
          <>
            <h1 className="mt-4 font-display text-[44px] font-bold leading-[0.95] tracking-[-0.05em]">This invite has been used or has ended.</h1>
            <p className="mt-4 text-[16px] leading-[1.5] text-black/60">Each invite works once, for 7 days. Ask the business for a new one.</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-balance font-display text-[44px] font-bold leading-[0.95] tracking-[-0.05em] md:text-[56px]">Join {business}.</h1>
            <p className="mt-4 text-[16px] leading-[1.5] text-black/60">{invite.business_name} invited <b className="text-[#0D0D0D]">{invite.email}</b> to work their leads on Setuvara.</p>
            <div className="mt-6 flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]">
              <span className="shrink-0 rounded-full bg-[#0D0D0D] px-2.5 py-1 font-label text-[10px] uppercase tracking-[0.12em] text-[#C7FF4A]">{ROLE_LABEL[invite.role]}</span>
              <p className="text-[14px] text-black/60">{ROLE_NOTE[invite.role]}</p>
            </div>
            <div className="mt-7 flex flex-col gap-3">
              {matches ? <AcceptInvite token={token} /> : signedIn ? (
                <>
                  <p className="text-[15px] leading-[1.5] text-black/65">You&apos;re signed in as {email ?? "another account"}. This invite is for {invite.email}.</p>
                  <form action={switchAccountForInvite.bind(null, token)}><button className={lineButton} type="submit">Sign out to switch</button></form>
                </>
              ) : (
                <>
                  <Link className={inkButton} href={next}>Sign in as {invite.email}</Link>
                  <p className="text-[14px] leading-[1.5] text-black/55">New to Setuvara? <Link className="font-semibold underline underline-offset-4" href="/signup">Create an account</Link> with {invite.email}, confirm your email, then open this link again.</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
