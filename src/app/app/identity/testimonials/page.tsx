import type { Metadata } from "next";

import { ActionsFrame } from "@/components/actions/actions-frame";
import { TestimonialsIndex } from "@/components/business/testimonials-pages";

export const metadata: Metadata = { title: "Testimonials · Setuvara" };

export default function TestimonialsPage() {
  return <ActionsFrame page="testimonials" slug="business"><TestimonialsIndex /></ActionsFrame>;
}
