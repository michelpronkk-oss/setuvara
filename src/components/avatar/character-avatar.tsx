// Setuvara's generated character portraits: flat, geometric, one-color-per-part.
// A name always produces the same character, so they work as default profile pictures.

const backgrounds = ["#ff5a4f", "#afcbff", "#c7ff4a", "#e8e2d4", "#ffd9d3"];
const skins = ["#f3d5c0", "#e6b995", "#c98e6a", "#a26b48", "#6f4631"];
const hairColors = ["#0d0d0d", "#3a271c", "#7a4a2a", "#c79a5e", "#ff5a4f"];
const shirts = ["#0d0d0d", "#f5f4ef", "#ff5a4f", "#afcbff"];
const hairStyles = ["short", "bob", "bun", "curly", "long", "buzz"] as const;

export type CharacterTraits = {
  background: string;
  skin: string;
  hair: string;
  hairStyle: (typeof hairStyles)[number];
  shirt: string;
  glasses: boolean;
};

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function characterTraits(seed: string): CharacterTraits {
  const h = hash(seed.trim().toLowerCase());
  const pick = <T,>(list: readonly T[], shift: number) => list[(h >>> shift) % list.length];
  const background = pick(backgrounds, 0);
  let shirt = pick(shirts, 5);
  if (shirt === background) shirt = shirts[(shirts.indexOf(shirt) + 1) % shirts.length];
  let hair = pick(hairColors, 15);
  if (hair === background) hair = hairColors[0];
  return { background, skin: pick(skins, 10), hair, hairStyle: pick(hairStyles, 20), shirt, glasses: (h >>> 27) % 4 === 0 };
}

export function CharacterAvatar({ seed, traits, className = "", title }: { seed: string; traits?: Partial<CharacterTraits>; className?: string; title?: string }) {
  const t = { ...characterTraits(seed), ...traits };
  const ink = "#0d0d0d";
  return (
    <svg aria-hidden={title ? undefined : true} className={className} focusable="false" role={title ? "img" : undefined} viewBox="0 0 100 100">
      {title ? <title>{title}</title> : null}
      <rect fill={t.background} height="100" width="100" />
      <g transform="translate(-6 -6.6) scale(1.12)">
      {t.hairStyle === "long" ? <path d="M27 44C27 20 40 14 50 14s23 6 23 30l3 40H24z" fill={t.hair} /> : null}
      {t.hairStyle === "bob" ? <path d="M28 44c0-22 12-28 22-28s22 6 22 28v19c-4 2-7 2-10 0V40H38v23c-3 2-6 2-10 0z" fill={t.hair} /> : null}
      <path d="M14 100c0-21 16-30 36-30s36 9 36 30z" fill={t.shirt} />
      <path d="M42 82c2 3 5 4 8 4s6-1 8-4" fill="none" stroke={t.shirt === ink ? "#f5f4ef" : ink} strokeOpacity=".25" strokeWidth="1.5" />
      <rect fill={t.skin} height="16" rx="5" width="14" x="43" y="58" />
      <circle cx="31.5" cy="47" fill={t.skin} r="4" />
      <circle cx="68.5" cy="47" fill={t.skin} r="4" />
      <ellipse cx="50" cy="45" fill={t.skin} rx="19" ry="22" />
      {t.hairStyle === "short" ? <path d="M31 43c0-18 10-25 20-25 11 0 19 8 18 25-4-8-11-13-19-13s-15 5-19 13z" fill={t.hair} /> : null}
      {t.hairStyle === "bob" || t.hairStyle === "long" ? <path d="M31 41c1-14 10-21 19-21 10 0 18 6 19 21-7-6-13-9-23-8-6 1-11 4-15 8z" fill={t.hair} /> : null}
      {t.hairStyle === "bun" ? <><circle cx="50" cy="15" fill={t.hair} r="8" /><path d="M31 42c0-16 9-23 19-23s19 7 19 23c-5-7-11-10-19-10s-14 3-19 10z" fill={t.hair} /></> : null}
      {t.hairStyle === "curly" ? <g fill={t.hair}><circle cx="34" cy="37" r="7" /><circle cx="38" cy="28" r="7.5" /><circle cx="46" cy="23" r="7.5" /><circle cx="55" cy="23" r="7.5" /><circle cx="63" cy="28" r="7.5" /><circle cx="67" cy="37" r="7" /></g> : null}
      {t.hairStyle === "buzz" ? <path d="M32 39c1-12 9-17 18-17s17 5 18 17c-6-5-12-7-18-7s-12 2-18 7z" fill={t.hair} /> : null}
      <path d="M40 41.5q3-2 6 0M54 41.5q3-2 6 0" fill="none" stroke={ink} strokeLinecap="round" strokeOpacity=".6" strokeWidth="1.4" />
      <circle cx="43" cy="47" fill={ink} r="1.9" />
      <circle cx="57" cy="47" fill={ink} r="1.9" />
      <circle cx="39" cy="54" fill="#ff5a4f" opacity=".22" r="3.2" />
      <circle cx="61" cy="54" fill="#ff5a4f" opacity=".22" r="3.2" />
      <path d="M45.5 56.5q4.5 3.5 9 0" fill="none" stroke={ink} strokeLinecap="round" strokeWidth="1.6" />
      {t.glasses ? <g fill="none" stroke={ink} strokeWidth="1.6"><circle cx="43" cy="47" r="5.2" /><circle cx="57" cy="47" r="5.2" /><path d="M48.2 47h3.6" /></g> : null}
      </g>
    </svg>
  );
}
