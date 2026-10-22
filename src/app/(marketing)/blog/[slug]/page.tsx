import { notFound } from "next/navigation";

import { BlogArticle } from "@/components/marketing/site/blog-views";
import { BLOG_POSTS, findPost } from "@/lib/marketing/blog-content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = findPost((await params).slug);
  if (!post) return {};
  const base = marketingMetadata({ title: `${post.title} | Setuvara`, description: post.description, path: `/blog/${post.slug}` });
  return { ...base, openGraph: { ...base.openGraph, type: "article", publishedTime: post.published, modifiedTime: post.updated ?? post.published } };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = findPost((await params).slug);
  if (!post) notFound();
  return <BlogArticle post={post} />;
}
