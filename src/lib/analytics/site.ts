import "server-only";

import { createBillingAdminClient } from "@/lib/billing/admin";

import { classifyAnalyticsDevice } from "./events";
import type { SitePage } from "./site-pages";


const CRAWLER = /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|headless|lighthouse/i;

/** Only the two-letter country the hosting edge derives; the IP address itself is never read. */
export function countryFromHeaders(headers: Headers) {
  const country = headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(country) ? country : null;
}

export function isCrawler(userAgent: string | null) {
  return !userAgent || CRAWLER.test(userAgent);
}

export async function recordSitePageView(page: SitePage, headers: Headers) {
  const userAgent = headers.get("user-agent");
  if (isCrawler(userAgent)) return false;
  try {
    const { error } = await createBillingAdminClient().rpc("record_site_page_view", {
      p_page: page,
      p_country: countryFromHeaders(headers),
      p_device_class: classifyAnalyticsDevice(userAgent),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Records a public site visit: path, section, edge country, device class and a referrer class only. */
export async function recordSiteVisit(visit: { path: string; section: SitePage; referrer: string }, headers: Headers) {
  const userAgent = headers.get("user-agent");
  if (isCrawler(userAgent)) return false;
  try {
    const { error } = await createBillingAdminClient().rpc("record_site_visit", {
      p_path: visit.path,
      p_section: visit.section,
      p_country: countryFromHeaders(headers),
      p_device_class: classifyAnalyticsDevice(userAgent),
      p_referrer: visit.referrer,
    });
    return !error;
  } catch {
    return false;
  }
}
