export type PassportStampType = "milestone" | "event" | "city" | "country";
export type PassportStampStatus = "earned" | "new" | "progress" | "locked";

const stampColors: Record<PassportStampType, { ink: string; paper: string; detail: string }> = {
  milestone: { ink: "#0D0D0D", paper: "#FF5A4F", detail: "#F5F4EF" },
  event: { ink: "#0D0D0D", paper: "#AFCBFF", detail: "#F5F4EF" },
  city: { ink: "#0D0D0D", paper: "#C7FF4A", detail: "#F5F4EF" },
  country: { ink: "#F5F4EF", paper: "#0D0D0D", detail: "#FF5A4F" },
};

export function PassportStamp({
  type,
  title,
  subtitle,
  status = "earned",
  rotationKey,
  size = "medium",
}: {
  type: PassportStampType;
  title: string;
  subtitle?: string | null;
  status?: PassportStampStatus;
  rotationKey?: string;
  size?: "small" | "medium" | "large";
}) {
  const colors = stampColors[type];
  const rotation = stableRotation(rotationKey ?? `${type}:${title}`);
  const shortTitle = title.length > 15 ? `${title.slice(0, 14).trim()}…` : title;
  const mark = type === "milestone" ? "✦" : type === "event" ? "◎" : type === "city" ? "⌖" : "✧";
  const sizeClass = size === "small" ? "size-[76px]" : size === "large" ? "size-40" : "size-[116px]";
  const isLocked = status === "locked";
  const isProgress = status === "progress";

  return (
    <figure
      aria-label={`${status === "new" ? "New " : ""}${status === "progress" ? "Progress toward " : ""}${status === "locked" ? "Locked " : ""}${type} stamp: ${title}${subtitle ? `, ${subtitle}` : ""}`}
      className={`relative m-0 ${sizeClass} ${isLocked ? "opacity-45 grayscale" : ""}`}
      data-passport-stamp={type}
      data-stamp-status={status}
    >
      {status === "new" && <span aria-hidden="true" className="absolute -right-1 -top-1 z-10 rounded-full bg-[#FF5A4F] px-2 py-1 font-label text-[8px] font-bold tracking-[0.13em] text-[#0D0D0D]">NEW</span>}
      <svg
        aria-hidden="true"
        className="h-full w-full overflow-visible"
        style={{ transform: `rotate(${rotation}deg)` }}
        viewBox="0 0 160 160"
      >
        <path
          d="M80 5 91 11 104 8 113 18 127 19 132 33 145 40 143 54 154 65 149 79 155 92 145 103 146 117 132 124 127 138 113 139 104 151 91 148 80 155 69 148 56 151 47 139 33 138 28 124 14 117 15 103 5 92 11 79 6 65 17 54 15 40 28 33 33 19 47 18 56 8 69 11Z"
          fill={colors.paper}
          stroke={colors.ink}
          strokeWidth="3"
        />
        <circle cx="80" cy="80" r="59" fill="none" stroke={colors.ink} strokeDasharray={isLocked || isProgress ? "4 5" : "1 0"} strokeOpacity={isLocked ? ".45" : ".82"} strokeWidth="1.5" />
        <circle cx="80" cy="80" r="51" fill="none" stroke={colors.ink} strokeOpacity=".48" strokeWidth="1" />
        <text fill={colors.ink} fontFamily="Arial, sans-serif" fontSize="8" fontWeight="700" letterSpacing="2.1" textAnchor="middle" x="80" y="46">SETUVARA</text>
        <path d="M47 54h66" stroke={colors.ink} strokeOpacity=".4" />
        <text fill={colors.ink} fontFamily="Georgia, serif" fontSize="26" textAnchor="middle" x="80" y="91">{isLocked ? "· · ·" : mark}</text>
        <text fill={colors.ink} fontFamily="Arial, sans-serif" fontSize={shortTitle.length > 11 ? "8" : "10"} fontWeight="700" letterSpacing=".55" textAnchor="middle" x="80" y="112">{isLocked ? "LOCKED" : isProgress ? "IN MOTION" : shortTitle.toLocaleUpperCase()}</text>
        <text fill={colors.ink} fontFamily="Arial, sans-serif" fontSize="7" fontWeight="600" letterSpacing="1.2" textAnchor="middle" x="80" y="126">{type.toUpperCase()}</text>
        {isProgress && <path d="M56 136h48" stroke={colors.ink} strokeWidth="2" strokeDasharray="3 3" />}
        {status === "earned" && <path d="M57 136h46" stroke={colors.detail} strokeWidth="2" />}
      </svg>
    </figure>
  );
}

function stableRotation(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 9) - 4;
}
