import { BlogIndex } from "@/components/marketing/site/blog-views";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Blog: networking and building in public | Setuvara",
  description: "Practical guides on meeting people at events, digital business cards, links in bio and sharing your startup’s revenue publicly.",
  path: "/blog",
});

export default function BlogPage() {
  return <BlogIndex />;
}
