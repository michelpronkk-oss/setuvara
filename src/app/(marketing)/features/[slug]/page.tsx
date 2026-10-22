import { notFound } from "next/navigation";

import { FeatureLanding } from "@/components/marketing/site/feature-landing";
import { FEATURE_ORDER, FEATURE_PAGES, type FeatureSlug } from "@/lib/marketing/features-content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return FEATURE_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = FEATURE_PAGES[(await params).slug as FeatureSlug];
  return page ? marketingMetadata({ title: page.metaTitle, description: page.metaDescription, path: `/features/${page.slug}` }) : {};
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in FEATURE_PAGES)) notFound();
  return <FeatureLanding slug={slug as FeatureSlug} />;
}
