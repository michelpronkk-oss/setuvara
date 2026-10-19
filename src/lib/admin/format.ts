const integer = new Intl.NumberFormat("en-US");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdRound = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayShort = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function formatCount(value: number | null | undefined) {
  return integer.format(value ?? 0);
}

export function formatMoneyMinor(value: number, round = false) {
  return (round ? usdRound : usd).format(value / 100);
}

function parse(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDay(value: string | null | undefined, short = false) {
  const date = parse(value);
  return date ? (short ? dayShort : day).format(date) : "—";
}

/** Dates are shown in UTC everywhere in admin so two admins always read the same time. */
export function formatDateTime(value: string | null | undefined) {
  const date = parse(value);
  return date ? `${dateTime.format(date)} UTC` : "—";
}

export function formatRelative(value: string | null | undefined, now = Date.now()) {
  const date = parse(value);
  if (!date) return "Never";
  const seconds = Math.round((now - date.getTime()) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);
  const unit = abs < 60 ? "just now"
    : abs < 3600 ? `${Math.floor(abs / 60)} min`
      : abs < 86_400 ? `${Math.floor(abs / 3600)} h`
        : abs < 86_400 * 60 ? `${Math.floor(abs / 86_400)} d`
          : abs < 86_400 * 730 ? `${Math.floor(abs / (86_400 * 30))} mo`
            : `${Math.floor(abs / (86_400 * 365))} y`;
  if (unit === "just now") return unit;
  return future ? `in ${unit}` : `${unit} ago`;
}

export function formatPercent(part: number, whole: number) {
  if (!whole) return "—";
  const value = (part / whole) * 100;
  return `${value >= 10 || value === 0 ? Math.round(value) : value.toFixed(1)}%`;
}

/** Change against the previous period of the same length; null when there is nothing to compare with. */
export function formatDelta(current: number, previous: number) {
  if (!previous && !current) return null;
  if (!previous) return { label: "new", direction: "up" as const };
  const change = Math.round(((current - previous) / previous) * 100);
  return { label: `${change > 0 ? "+" : ""}${change}%`, direction: change > 0 ? "up" as const : change < 0 ? "down" as const : "flat" as const };
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct link", qr: "QR code", quick_qr: "Quick QR", tap: "Setuvara Tap", share: "Share link",
  native_share: "Phone share sheet", link: "Link", direct_share: "Direct share", profile: "From a profile", other: "Other", unknown: "Unknown",
};

/** Readable names for the closed source enum used by analytics and encounters. */
export function sourceLabel(value: string) {
  return SOURCE_LABELS[value] ?? titleCase(value);
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/[_-]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
