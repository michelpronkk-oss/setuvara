import type { PlanCode } from "@/lib/billing/catalog";

// Status badge system (Round 02). Plus: 12-facet coral burst. Pro: two-layer champagne burst.
// Shapes differ, so the badges survive grayscale and 14px. The Setuvara Mark has no data field yet, so it is not rendered.
const BURST_12 = "50,4 59.71,13.78 73,10.16 76.52,23.48 89.84,27 86.22,40.29 96,50 86.22,59.71 89.84,73 76.52,76.52 73,89.84 59.71,86.22 50,96 40.29,86.22 27,89.84 23.48,76.52 10.16,73 13.78,59.71 4,50 13.78,40.29 10.16,27 23.48,23.48 27,10.16 40.29,13.78";
const PRO_BACK = "62.16,4.6 69.5,16.23 83.23,16.77 83.77,30.5 95.4,37.84 89,50 95.4,62.16 83.77,69.5 83.23,83.23 69.5,83.77 62.16,95.4 50,89 37.84,95.4 30.5,83.77 16.77,83.23 16.23,69.5 4.6,62.16 11,50 4.6,37.84 16.23,30.5 16.77,16.77 30.5,16.23 37.84,4.6 50,11";
const PRO_FRONT = "50,7 59.32,15.23 71.5,12.76 75.46,24.54 87.24,28.5 84.77,40.68 93,50 84.77,59.32 87.24,71.5 75.46,75.46 71.5,87.24 59.32,84.77 50,93 40.68,84.77 28.5,87.24 24.54,75.46 12.76,71.5 15.23,59.32 7,50 15.23,40.68 12.76,28.5 24.54,24.54 28.5,12.76 40.68,15.23";

export const BADGE_COPY = {
  plus: { label: "Setuvara Plus member", title: "Setuvara Plus" },
  pro: { label: "Setuvara Pro member", title: "Setuvara Pro" },
} as const;

export function StatusBadge({ plan, size = 20, surface = "light", className = "" }: {
  plan: PlanCode;
  size?: 14 | 16 | 18 | 20 | 24 | 30 | 36;
  surface?: "light" | "dark";
  className?: string;
}) {
  if (plan === "free") return null;
  const copy = BADGE_COPY[plan];
  return (
    <svg aria-label={copy.label} className={`inline-block shrink-0 ${className}`} height={size} role="img" viewBox="0 0 100 100" width={size}>
      <title>{copy.title}</title>
      {plan === "plus" ? (
        <>
          <polygon fill="#FF5A4F" points={BURST_12} stroke="#FF5A4F" strokeLinejoin="round" strokeWidth={4} />
          <path d="M31 51L44 63L69 37" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeLinejoin="round" strokeWidth={10} />
        </>
      ) : (
        <>
          <polygon fill={surface === "dark" ? "#E8D28A" : "#B8954A"} points={PRO_BACK} stroke={surface === "dark" ? "#E8D28A" : "#B8954A"} strokeLinejoin="round" strokeWidth={3} />
          <polygon fill="#D6B25E" points={PRO_FRONT} stroke="#D6B25E" strokeLinejoin="round" strokeWidth={3} />
          <path d="M32 51L44.5 62.5L68 38.5" fill="none" stroke="#0D0D0D" strokeLinecap="round" strokeLinejoin="round" strokeWidth={9.5} />
        </>
      )}
    </svg>
  );
}
