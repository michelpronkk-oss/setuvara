import { notFound } from "next/navigation";

import { TemplatePage } from "@/components/marketing/site/template-views";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { findTemplate, TEMPLATE_SLUGS } from "@/lib/marketing/templates-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const template = findTemplate((await params).slug);
  if (!template) return {};
  const description = template.kind === "look"
    ? `The ${template.name} Look for your Setuvara page: ${template.line.toLowerCase()} ${template.bestFor} ${template.free ? "Free." : "On Plus and Pro."}`
    : `A ${template.name} page template for Setuvara: ${template.line.toLowerCase()} Phone and desktop views, free to start.`;
  return marketingMetadata({ title: `${template.name} template | Setuvara`, description, path: `/templates/${template.slug}` });
}

export default async function TemplateRoute({ params }: { params: Promise<{ slug: string }> }) {
  const template = findTemplate((await params).slug);
  if (!template) notFound();
  return <TemplatePage template={template} />;
}
