"use client";

import { QRCodeSVG } from "qrcode.react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { inkOnAccent } from "@/components/profile/appearance";

/**
 * The free QR code generator at /tools/qr-code-generator. Everything happens in the browser: the
 * link never leaves the page, and the download is the drawing on screen, with no watermark and
 * nothing that expires. The modules always stay ink on white with a full quiet zone, so every style
 * scans; the styles only change what surrounds the code, exactly like the QR styles on a Setuvara
 * page.
 */

const STYLES = [
  { id: "standard", name: "Standard" },
  { id: "accent-frame", name: "Accent frame" },
  { id: "rounded", name: "Rounded" },
  { id: "inverse", name: "Inverse" },
] as const;
type Style = (typeof STYLES)[number]["id"];

const SWATCHES = ["#FF5A4F", "#0D0D0D", "#2BB673", "#3D7BFF", "#7C5CFF", "#E8A6FF", "#FFC94D", "#F2994A"];
const PREVIEWS = [{ id: "code", name: "Code" }, { id: "card", name: "Business card" }, { id: "poster", name: "Poster" }] as const;
type Preview = (typeof PREVIEWS)[number]["id"];

const MAX_LENGTH = 1200;

/** What a pasted value becomes: bare domains get https://, anything else is encoded as typed. */
export function normalizeTarget(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return text;
  if (/^[^\s/]+\.[^\s/]{2,}(\/\S*)?$/.test(text)) return `https://${text}`;
  return text;
}

/** A handle suggestion from the pasted link (instagram.com/sena → sena), for the sign-up hook. */
export function handleFrom(value: string) {
  try {
    const url = new URL(normalizeTarget(value));
    const part = url.pathname.split("/").filter(Boolean).at(-1)?.replace(/^@/, "") ?? url.hostname.replace(/^www\./, "").split(".")[0];
    const handle = part.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    return handle.length >= 3 ? handle : "";
  } catch {
    return "";
  }
}

/** The full drawing as one SVG: frame, white field, the code, and the optional caption. */
function QrDrawing({ id, value, style, accent, caption, size = 320 }: { id?: string; value: string; style: Style; accent: string; caption: string; size?: number }) {
  const framed = style === "rounded" || style === "inverse";
  const label = framed && caption.trim() ? caption.trim().slice(0, 32) : "";
  const pad = style === "standard" ? 24 : style === "accent-frame" ? 36 : 20;
  const code = size - pad * 2;
  // About three modules of white around the code on dark frames, so scanners find the edge.
  const fieldPad = framed ? 26 : 0;
  const width = size;
  const height = size + (label ? 56 : 0);
  const outer = style === "inverse" ? "#0D0D0D" : style === "rounded" ? accent : "#FFFFFF";
  const ink = style === "inverse" ? "#F5F4EF" : inkOnAccent(accent);
  const field = framed ? { x: pad, y: pad, w: size - pad * 2, r: style === "rounded" ? 26 : 16 } : null;
  const codeSize = framed ? code - fieldPad * 2 : code;
  const codeAt = framed ? pad + fieldPad : pad;
  return (
    <svg data-qr-style={style} height={height} id={id} role="img" viewBox={`0 0 ${width} ${height}`} width={width} xmlns="http://www.w3.org/2000/svg">
      <title>{`QR code for ${value}`}</title>
      <rect fill={outer} height={height} rx={style === "rounded" ? 44 : 28} width={width} />
      {style === "standard" && <rect fill="none" height={height - 1} rx={27.5} stroke="#0D0D0D" strokeOpacity={0.12} width={width - 1} x={0.5} y={0.5} />}
      {style === "accent-frame" && <rect fill="none" height={height - 24} rx={20} stroke={accent} strokeWidth={8} width={width - 24} x={12} y={12} />}
      {field && <rect fill="#FFFFFF" height={field.w} rx={field.r} width={field.w} x={field.x} y={field.y} />}
      <svg height={codeSize} width={codeSize} x={codeAt} y={codeAt}>
        <QRCodeSVG bgColor="#FFFFFF" fgColor="#0D0D0D" level="Q" marginSize={0} size={codeSize} value={value || " "} />
      </svg>
      {label && <text dominantBaseline="middle" fill={ink} fontFamily="Inter, Helvetica, Arial, sans-serif" fontSize={22} fontWeight={800} letterSpacing={-0.4} textAnchor="middle" x={width / 2} y={size + 18}>{label}</text>}
    </svg>
  );
}

async function download(svgId: string, format: "png" | "svg", filename: string) {
  const svg = document.getElementById(svgId);
  if (!(svg instanceof SVGSVGElement)) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const [width, height] = [Number(svg.getAttribute("width")), Number(svg.getAttribute("height"))];
  const scale = 2048 / width;
  clone.setAttribute("width", String(Math.round(width * scale)));
  clone.setAttribute("height", String(Math.round(height * scale)));
  const markup = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  const save = (href: string, extension: string) => { const anchor = document.createElement("a"); anchor.href = href; anchor.download = `${filename}.${extension}`; anchor.click(); };
  if (format === "svg") { save(svgUrl, "svg"); window.setTimeout(() => URL.revokeObjectURL(svgUrl), 1000); return; }
  const image = new window.Image();
  image.src = svgUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(svgUrl);
  canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); save(url, "png"); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }, "image/png");
}

function Segment<T extends string>({ label, options, value, onChange, dark }: { label: string; options: readonly { id: T; name: string }[]; value: T; onChange: (next: T) => void; dark?: boolean }) {
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className={`inline-flex gap-1 rounded-full p-1 ${dark ? "bg-ink/80 backdrop-blur" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)]"}`}>
        {options.map((option) => (
          <label className={`inline-flex min-h-10 cursor-pointer items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors sm:px-4 sm:text-[14px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral ${value === option.id ? (dark ? "bg-paper text-ink" : "bg-ink text-paper") : dark ? "text-paper/70 hover:text-paper" : "text-ink/65 hover:text-ink"}`} key={option.id}>
            <input checked={value === option.id} className="sr-only" name={label} onChange={() => onChange(option.id)} type="radio" value={option.id} />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="border-t border-ink/10 pt-6 first:border-0 first:pt-0">
      <p className="flex items-baseline gap-3"><span className="font-label text-[11px] tracking-[0.16em] text-coral">0{n}</span><span className="text-[17px] font-semibold tracking-[-0.01em]">{title}</span></p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** `stage` is the backdrop the preview stands on, drawn by the server page. */
export function QrGenerator({ stage }: { stage?: ReactNode }) {
  const [raw, setRaw] = useState("");
  const [style, setStyle] = useState<Style>("standard");
  const [accent, setAccent] = useState(SWATCHES[0]);
  const [caption, setCaption] = useState("Scan me");
  const [preview, setPreview] = useState<Preview>("code");
  const [busy, setBusy] = useState<"png" | "svg" | null>(null);
  const inputId = useId();
  const captionId = useId();
  const colorId = useId();
  const svgId = "qr-tool-drawing";

  const value = normalizeTarget(raw).slice(0, MAX_LENGTH);
  const ready = value.length > 0;
  const suggested = useMemo(() => handleFrom(raw), [raw]);
  const filename = useMemo(() => {
    try { return `qr-${new URL(value).hostname.replace(/^www\./, "").replace(/[^a-z0-9-]/gi, "-")}`; } catch { return "qr-code"; }
  }, [value]);
  const framed = style === "rounded" || style === "inverse";
  const showColor = style === "accent-frame" || style === "rounded";

  async function save(format: "png" | "svg") {
    setBusy(format);
    try { await download(svgId, format, filename); } finally { setBusy(null); }
  }

  const drawing = <QrDrawing accent={accent} caption={caption} id={svgId} style={style} value={ready ? value : "https://setuvara.com"} />;

  const tileValue = "https://setuvara.com";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-6 rounded-[28px] bg-white p-6 shadow-[0_40px_80px_-60px_rgba(13,13,13,.5)] sm:p-8">
        <Step n={1} title="Paste your link">
          <label className="sr-only" htmlFor={inputId}>Your link</label>
          <input
            autoCapitalize="none"
            autoComplete="url"
            autoCorrect="off"
            className="block min-h-14 w-full rounded-2xl bg-paper px-4 text-[17px] font-medium shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.12)] outline-none placeholder:font-normal placeholder:text-ink/35 focus:shadow-[inset_0_0_0_2px_#0D0D0D]"
            id={inputId}
            inputMode="url"
            maxLength={MAX_LENGTH}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="instagram.com/yourname"
            spellCheck={false}
            value={raw}
          />
          <p className="mt-2 min-h-5 text-[13px] text-ink/55" aria-live="polite">{ready ? <>Encodes <span className="break-all font-label text-ink/75">{value.length > 70 ? `${value.slice(0, 70)}…` : value}</span></> : "Any link: a profile, a menu, a form, a file."}</p>
        </Step>

        <Step n={2} title="Pick a style">
          <fieldset>
            <legend className="sr-only">Style</legend>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {STYLES.map((option) => (
                <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-[18px] p-2 pb-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-coral sm:p-3 ${style === option.id ? "bg-paper shadow-[inset_0_0_0_2px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.1)] hover:bg-paper"}`} key={option.id}>
                  <input checked={style === option.id} className="sr-only" name="Style" onChange={() => setStyle(option.id)} type="radio" value={option.id} />
                  <span aria-hidden="true" className="block w-full [&>svg]:h-auto [&>svg]:w-full"><QrDrawing accent={accent} caption="" size={160} style={option.id} value={tileValue} /></span>
                  <span className="text-[12px] font-semibold leading-tight sm:text-[13px]">{option.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Step>

        <Step n={3} title={showColor || framed ? "Colour and caption" : "Download"}>
          {showColor && (
            <fieldset>
              <legend className="sr-only">Colour</legend>
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((swatch) => (
                  <button aria-label={`Colour ${swatch}`} aria-pressed={accent === swatch} className={`size-9 rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${accent === swatch ? "scale-110 shadow-[0_0_0_2px_#FFFFFF,0_0_0_4px_#0D0D0D]" : "shadow-[inset_0_0_0_1px_rgba(13,13,13,.12)]"}`} key={swatch} onClick={() => setAccent(swatch)} style={{ background: swatch }} type="button" />
                ))}
                <label className="ml-1 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full bg-paper px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)]" htmlFor={colorId}>
                  <input className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0" id={colorId} onChange={(event) => setAccent(event.target.value.toUpperCase())} type="color" value={accent} />
                  Custom
                </label>
              </div>
            </fieldset>
          )}
          {framed && (
            <div className={showColor ? "mt-4" : ""}>
              <label className="font-label text-[11px] uppercase tracking-[0.16em] text-ink/50" htmlFor={captionId}>Caption</label>
              <input className="mt-2 block min-h-12 w-full rounded-2xl bg-paper px-4 text-[16px] font-medium shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.12)] outline-none focus:shadow-[inset_0_0_0_2px_#0D0D0D]" id={captionId} maxLength={32} onChange={(event) => setCaption(event.target.value)} placeholder="Scan me" value={caption} />
            </div>
          )}
          {showColor || framed ? <p className="mt-3 text-[12.5px] text-ink/50">The code itself stays black on white, so it scans everywhere.</p> : null}
          <div className={`flex flex-wrap gap-3 ${showColor || framed ? "mt-6" : ""}`}>
            <button className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 text-[15px] font-semibold text-paper hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" disabled={!ready || busy !== null} onClick={() => void save("png")} type="button">{busy === "png" ? "Saving…" : "Download PNG"}</button>
            <button className="inline-flex min-h-12 items-center rounded-full px-6 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(13,13,13,.2)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral" disabled={!ready || busy !== null} onClick={() => void save("svg")} type="button">{busy === "svg" ? "Saving…" : "Download SVG"}</button>
          </div>
          <p className="mt-3 text-[13px] text-ink/55">2048 px PNG or a vector SVG. No watermark, no sign-up, never expires.</p>
        </Step>
      </div>

      <div className="flex flex-col gap-6">
        <div className="relative isolate grid min-h-[460px] place-items-center overflow-hidden rounded-[28px] bg-[#E9E4D9] p-6 pt-24 sm:min-h-[600px] sm:p-12 sm:pt-24" data-preview={preview}>
          {stage ? <div aria-hidden="true" className="absolute inset-0 -z-10 [&>*]:size-full">{stage}</div> : null}
          <div className="absolute left-1/2 top-5 -translate-x-1/2 sm:top-6"><Segment dark label="Preview" onChange={setPreview} options={PREVIEWS} value={preview} /></div>
          {preview === "code" && <div className={`w-full max-w-[340px] drop-shadow-[0_40px_50px_rgba(13,13,13,.35)] transition-opacity ${ready ? "" : "opacity-50"}`}>{drawing}</div>}
          {preview === "card" && (
            <div className="flex aspect-[1.75] w-full max-w-[480px] items-stretch justify-between gap-4 rounded-[14px] bg-white p-5 shadow-[0_40px_80px_-30px_rgba(13,13,13,.55)] sm:p-7">
              <div className="flex min-w-0 flex-col justify-between">
                <div><p className="font-display text-[clamp(18px,2.4vw,26px)] font-extrabold leading-none tracking-[-0.045em]">Your Name</p><p className="mt-1.5 text-[12px] text-ink/55">What you do · Where you are</p></div>
                <p className="truncate font-label text-[10px] text-ink/50">{ready ? value.replace(/^https?:\/\//, "") : "your link"}</p>
              </div>
              <div className={`aspect-square h-full shrink-0 [&>svg]:size-full ${ready ? "" : "opacity-50"}`}>{drawing}</div>
            </div>
          )}
          {preview === "poster" && (
            <div className="flex aspect-[1/1.414] w-full max-w-[320px] flex-col justify-between rounded-[6px] p-6 shadow-[0_40px_80px_-30px_rgba(13,13,13,.55)]" style={{ background: style === "inverse" ? "#0D0D0D" : accent, color: style === "inverse" ? "#F5F4EF" : inkOnAccent(accent) }}>
              <p className="font-display text-[34px] font-extrabold leading-[0.9] tracking-[-0.055em]">Scan to<br />see more.</p>
              <div className={`mx-auto w-[72%] [&>svg]:h-auto [&>svg]:w-full ${ready ? "" : "opacity-50"}`}>{drawing}</div>
              <p className="truncate font-label text-[10px] opacity-75">{ready ? value.replace(/^https?:\/\//, "") : "your link"}</p>
            </div>
          )}
        </div>

        <form action="/signup" className="rounded-[28px] bg-ink p-6 text-paper sm:p-8" method="get">
          <p className="font-display text-[28px] font-extrabold leading-[0.95] tracking-[-0.05em]">Make it a Setuvara code.</p>
          <p className="mt-2 text-[15px] leading-[1.55] text-paper/65">This code is your link forever. A Setuvara code opens your page, and you choose which Mode it shows. Free.</p>
          <div className="mt-5 flex h-[56px] items-center gap-1 rounded-full bg-paper pl-4 pr-1.5 text-ink">
            <label className="sr-only" htmlFor={`${inputId}-claim`}>Choose your Setuvara username</label>
            <span aria-hidden="true" className="shrink-0 font-label text-[14px] text-ink/55">setuvara.com/</span>
            <input autoCapitalize="none" autoComplete="off" className="min-w-0 flex-1 bg-transparent font-label text-[16px] font-medium outline-none placeholder:text-ink/35" defaultValue={suggested} id={`${inputId}-claim`} key={suggested} maxLength={24} name="username" pattern="[A-Za-z0-9_]{3,24}" placeholder="yourname" spellCheck={false} title="3–24 letters, numbers, or underscores" />
            <button className="h-11 shrink-0 rounded-full bg-coral px-5 text-[15px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper" type="submit">Claim</button>
          </div>
        </form>
      </div>
    </div>
  );
}
