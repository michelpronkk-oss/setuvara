import Link from "next/link";

import { PlusTag } from "@/app/app/identity/editor-ui";
import type { ModeSlug } from "@/components/profile/types";
import { ACTION_KIND_BLURB, ACTION_KIND_NAME, ACTION_KIND_TINT, MODE_KIND_ORDER, type ActionKind, type ActionLimits } from "@/lib/actions/model";

export const KIND_GLYPH: Record<ActionKind, string> = { newsletter: "@", form: "≡", collab: "◆", giveaway: "✦", booking: "◷", submission: "?" };

export function KindTile({ kind, size = 48 }: { kind: ActionKind; size?: number }) {
  return <span aria-hidden="true" className="grid shrink-0 place-items-center font-display font-bold" style={{ width: size, height: size, borderRadius: size * 0.3, background: ACTION_KIND_TINT[kind], fontSize: size * 0.42 }}>{KIND_GLYPH[kind]}</span>;
}

/** Every kind, the Mode's best fits first, each with what it does. Giveaways say when they need Plus. */
export function KindPicker({ limits, slug, hrefFor }: { limits: ActionLimits; slug: ModeSlug; hrefFor: (kind: ActionKind) => string }) {
  const order = MODE_KIND_ORDER[slug];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {order.map((kind, index) => (
        <li key={kind}>
          <Link className="group relative flex h-full items-start gap-4 overflow-hidden rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1.5px_#0D0D0D,0_18px_40px_-28px_rgba(13,13,13,.5)] focus-visible:outline-2" href={hrefFor(kind)}>
            <KindTile kind={kind} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><span className="text-[17px] font-semibold">{ACTION_KIND_NAME[kind]}</span>{kind === "giveaway" && limits.open_giveaways === 0 && <PlusTag />}{index < 2 && <span className="rounded-full bg-[#F5F4EF] px-2 py-0.5 font-label text-[10px] uppercase tracking-[0.12em] text-black/55">Suggested</span>}</span>
              <span className="mt-1 block text-[14px] leading-[1.45] text-black/65">{ACTION_KIND_BLURB[kind]}</span>
            </span>
            <span aria-hidden="true" className="self-center text-black/30 transition group-hover:translate-x-0.5 group-hover:text-black">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
