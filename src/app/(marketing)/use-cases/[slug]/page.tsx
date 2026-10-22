import { notFound } from "next/navigation";

import { UseCaseLanding } from "@/components/marketing/site/use-case-landing";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { USE_CASE_ORDER, USE_CASES } from "@/lib/marketing/use-cases-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASE_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = USE_CASES[(await params).slug];
  if (!page) return {};
  return marketingMetadata({ title: page.metaTitle, description: page.metaDescription, path: `/use-cases/${page.slug}` });
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!USE_CASES[slug]) notFound();
  return <UseCaseLanding slug={slug} />;
}
