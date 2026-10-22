"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ActionCards } from "@/components/actions/action-card";
import { PublicBuilder } from "@/components/builder/public-builder";
import { PublicTestimonials } from "@/components/business/public-testimonials";
import { CreatorAudience } from "@/components/creator/creator-audience";
import { CreatorSections } from "@/components/creator/creator-sections";
import { inkOnAccent, resolveAppearance, resolveModeAccent } from "@/components/profile/appearance";
import { appearanceTheme } from "@/components/profile/appearance-theme";
import { nameType, nameTypeStyle } from "@/components/profile/name-type";
import type { PublicAction } from "@/lib/actions/model";
import type { PublicProject } from "@/lib/builder/model";
import type { PublicTestimonial } from "@/lib/business/testimonials";
import type { PublicProduct } from "@/lib/commerce/public";
import { readCreatorSettings } from "@/lib/creator/studio";
import type { PublicPlatform } from "@/lib/social/model";
import type { EditorApi } from "./editor-types";

type Pieces = { actions: { action: PublicAction; coverUrl: string | null }[]; projects: PublicProject[]; testimonials: PublicTestimonial[]; platforms: PublicPlatform[]; offers: PublicProduct[] };

/**
 * The real cards for everything on the page besides blocks and links (Actions, Builder projects,
 * testimonials, the Creator sections; its work blocks already show as blocks here), drawn with the same components as the public page and
 * keyed by page order entry. Nothing in the preview counts as a view or takes a vote.
 */
export function usePreviewPieces(api: EditorApi): Record<string, ReactNode> | undefined {
  const { mode, plan } = api;
  const slug = mode.slug;
  const [data, setData] = useState<{ slug: string; pieces: Pieces } | null>(null);
  // Refetch when what the list holds changes (an Action published, a project added).
  const shape = api.pageOrder?.order.filter((key) => !key.startsWith("block:") && !key.startsWith("link:")).join(",") ?? "";

  useEffect(() => {
    let live = true;
    void fetch(`/api/editor/preview-pieces?mode=${slug}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<Pieces> : null))
      .then((pieces) => { if (live && pieces) setData({ slug, pieces }); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [slug, shape]);

  return useMemo(() => {
    if (!data || data.slug !== slug) return undefined;
    const { actions, projects, testimonials, platforms, offers } = data.pieces;
    const accent = resolveModeAccent(mode);
    const accentInk = inkOnAccent(accent);
    const look = resolveAppearance(mode, plan);
    const type = nameTypeStyle(nameType(look.nameFont, appearanceTheme(look.id, look.accent, Boolean(mode.image_path)).identity));
    const display = { fontFamily: type.fontFamily, fontWeight: type.fontWeight, fontStyle: type.fontStyle, textTransform: type.textTransform, letterSpacing: type.letterSpacing };
    const blocks = mode.blocks ?? [];
    const images: Record<string, string | null> = Object.fromEntries(blocks.map((block) => [block.id, typeof (block.data as Record<string, unknown>).image_url === "string" ? (block.data as Record<string, unknown>).image_url as string : null]));
    const creator = slug === "creator";
    return {
      ...Object.fromEntries((creator ? [] : actions).map((item) => [`action:${item.action.id}`, <ActionCards accent={accent} accentInk={accentInk} actions={[item]} key={item.action.id} />])),
      ...Object.fromEntries(projects.map((project) => [`project:${project.id}`, <PublicBuilder accent={accent} accentInk={accentInk} actions={actions.map((item) => item.action)} bare display={display} images={images} key={project.id} projects={[project]} />])),
      "section:testimonials": <PublicTestimonials accent={accent} items={testimonials} />,
      "section:audience": <CreatorAudience accent={accent} display={display} platforms={platforms} />,
      "section:creator": creator ? <CreatorSections accent={accent} accentInk={accentInk} actions={actions} offers={offers} settings={readCreatorSettings(mode.settings as Record<string, unknown>)} work={[]} /> : null,
    };
  }, [data, slug, mode, plan]);
}
