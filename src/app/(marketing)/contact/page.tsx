import { ContactPage } from "@/components/marketing/contact/contact-page";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Contact | Setuvara",
  description: "Write to Setuvara about support, partnerships, events or teams. A person reads every message.",
  path: "/contact",
});

export default function ContactRoute() {
  return <ContactPage />;
}
