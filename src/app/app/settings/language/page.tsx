import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Region" };

export default function LanguageSettingsPage(): never {
  permanentRedirect("/app/settings/region");
}
