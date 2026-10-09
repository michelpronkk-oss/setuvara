// Hand-drawn SVG flags. Emoji flags render as plain letters on Windows, so the
// homepage draws its own for the countries in the example connections.

type Country = "NL" | "PT" | "IE" | "FI";

const names: Record<Country, string> = { NL: "Netherlands", PT: "Portugal", IE: "Ireland", FI: "Finland" };

export function Flag({ country, className = "" }: { country: Country; className?: string }) {
  return (
    <svg aria-label={names[country]} className={`inline-block shrink-0 overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgba(13,13,13,.18)] ${className}`} role="img" viewBox="0 0 30 20">
      {country === "NL" ? (
        <>
          <rect fill="#ae1c28" height="6.67" width="30" />
          <rect fill="#ffffff" height="6.67" width="30" y="6.67" />
          <rect fill="#21468b" height="6.67" width="30" y="13.33" />
        </>
      ) : null}
      {country === "PT" ? (
        <>
          <rect fill="#da291c" height="20" width="30" />
          <rect fill="#046a38" height="20" width="12" />
          <circle cx="12" cy="10" fill="#ffe900" r="4.6" />
          <circle cx="12" cy="10" fill="none" r="3.1" stroke="#da291c" strokeWidth="1" />
          <rect fill="#ffffff" height="3.6" rx=".6" stroke="#da291c" strokeWidth=".6" width="3" x="10.5" y="8.2" />
        </>
      ) : null}
      {country === "IE" ? (
        <>
          <rect fill="#169b62" height="20" width="10" />
          <rect fill="#ffffff" height="20" width="10" x="10" />
          <rect fill="#ff883e" height="20" width="10" x="20" />
        </>
      ) : null}
      {country === "FI" ? (
        <>
          <rect fill="#ffffff" height="20" width="30" />
          <rect fill="#002f6c" height="20" width="5" x="8" />
          <rect fill="#002f6c" height="5" width="30" y="7.5" />
        </>
      ) : null}
    </svg>
  );
}

export type { Country };
