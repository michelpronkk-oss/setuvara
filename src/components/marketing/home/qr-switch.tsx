import { nameFontClasses } from "@/components/profile/name-fonts";

import { QrArt } from "../site/qr-art";
import { DEMO_PEOPLE, ModePhone } from "./mode-phone";
import { QrSwitch } from "./qr-switch-client";

/** The same person on each Mode, so the switch reads as one code, four versions of her. */
const SCREENS: { slug: "personal" | "event" | "business" | "creator"; name: string; where: string; look: Parameters<typeof ModePhone>[0]["look"] }[] = [
  { slug: "personal", name: "Personal", where: "With friends", look: { theme: "stack" as const, pictures: ["/pricing/aanya-wide.webp"] } },
  { slug: "event", name: "Event", where: "At Slush", look: { theme: "immersive" as const, accent: "#C7FF4A", nameFont: "impact", namePosition: "bottom" } },
  { slug: "business", name: "Business", where: "With clients", look: { theme: "clean" } },
  { slug: "creator", name: "Creator", where: "With brands", look: { theme: "film" } },
];

export function QrModeSwitch() {
  return (
    <div className={nameFontClasses}>
      <QrSwitch
        labels={SCREENS.map(({ slug, name, where }) => ({ slug, name, where }))}
        qr={<QrArt size={192} value="https://setuvara.com/aanya" />}
        screens={SCREENS.map((screen) => <ModePhone key={screen.slug} label={`Aanya Rao, ${screen.name} Mode`} look={screen.look} slug={screen.slug} who={DEMO_PEOPLE.aanya} />)}
      />
    </div>
  );
}
