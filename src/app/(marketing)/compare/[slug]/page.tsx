import { notFound } from "next/navigation";

import { CompareLanding } from "@/components/marketing/site/compare-landing";
import { COMPARE_ORDER, COMPARE_PAGES } from "@/lib/marketing/compare-content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARE_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = COMPARE_PAGES[(await params).slug];
  if (!page) return {};
  return marketingMetadata({ title: page.metaTitle, description: page.metaDescription, path: `/compare/${page.slug}` });
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!COMPARE_PAGES[slug]) notFound();
  return <CompareLanding slug={slug} />;
}
