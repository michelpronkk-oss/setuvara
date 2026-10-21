import { notFound } from "next/navigation";

import { Head } from "@/components/actions/actions-pages";
import { EmptyState, StudioPage } from "@/components/creator/studio-ui";
import { loadTestimonials } from "@/lib/business/studio-server";
import { TestimonialsBoard } from "./testimonials-client";

const eyebrow = <><span aria-hidden="true" className="size-2 rounded-full bg-[#FFE7B8] shadow-[inset_0_0_0_1px_rgba(13,13,13,.2)]" />Business Mode</>;

/** Business Mode's testimonials: ask a client with a private link, then choose what shows on the page. */
export async function TestimonialsIndex() {
  const data = await loadTestimonials();
  if (!data.mode) notFound();
  if (!data.ready) return <StudioPage><Head eyebrow={eyebrow} title="Testimonials" /><EmptyState body="Testimonials need a database update that hasn't reached this site yet." title="Not ready yet." /></StudioPage>;
  const { testimonials, requests, limits } = data;
  const approved = testimonials.filter((item) => item.status === "approved").length;
  const waiting = testimonials.filter((item) => item.status === "pending").length;
  return (
    <StudioPage className="max-w-[1180px]">
      <Head
        eyebrow={eyebrow}
        sub={testimonials.length ? `${Math.min(approved, limits.testimonials_shown)} on your page · ${waiting} waiting for you` : "Words from real clients, invited by you, shown only when you approve them."}
        title="Testimonials"
      />
      <TestimonialsBoard owner={data.profile.display_name} plan={limits.plan} requests={requests} shown={limits.testimonials_shown} testimonials={testimonials} />
    </StudioPage>
  );
}
