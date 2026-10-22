import { ModeLanding } from "@/components/marketing/site/mode-landing";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { MODE_PAGES } from "@/lib/marketing/modes-content";

const page = MODE_PAGES.business;

export const metadata = marketingMetadata({ title: page.metaTitle, description: page.metaDescription, path: page.path });

export default function BusinessModePage() {
  return <ModeLanding slug="business" />;
}
