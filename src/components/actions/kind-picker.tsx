import Link from "next/link";

import { PlusTag } from "@/app/app/identity/editor-ui";
import { ACTION_KIND_BLURB, ACTION_KIND_NAME, ACTION_KIND_TINT, ACTION_KINDS, type ActionKind, type ActionLimits } from "@/lib/actions/model";

export const KIND_GLYPH: Record<ActionKind, string> = { collab: "◆", giveaway: "✦", booking: "◷", submission: "?" };

export function KindTile({ kind, size = 48 }: { kind: ActionKind; size?: number }) {
  return <span aria-hidden="true" className="grid shrink-0 place-items-center font-display font-bold" style={{ width: size, height: size, borderRadius: size * 0.3, background: ACTION_KIND_TINT[kind], fontSize: size * 0.42 }}>{KIND_GLYPH[kind]}</span>;
}

/** The four Actions, each with what it does. Giveaways say when they need Plus. */
export function KindPicker({ limits }: { limits: ActionLimits }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ACTION_KINDS.map((kind) => (
        <li key={kind}>
          <Link className="flex h-full items-start gap-4 rounded-[22px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] transition hover:shadow-[inset_0_0_0_1.5px_#0D0D0D] focus-visible:outline-2" href={`/app/identity/creator/actions/new?kind=${kind}`}>
            <KindTile kind={kind} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><span className="text-[17px] font-semibold">{ACTION_KIND_NAME[kind]}</span>{kind === "giveaway" && limits.open_giveaways === 0 && <PlusTag />}</span>
              <span className="mt-1 block text-[14px] leading-[1.45] text-black/65">{ACTION_KIND_BLURB[kind]}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
