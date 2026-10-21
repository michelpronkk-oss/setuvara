import { byStage, PROJECT_STATUS_LABEL, ROADMAP_STAGE_LABEL, safeHttps, type PublicProject, type RoadmapStage } from "@/lib/builder/model";
import { ctaFor, type PublicAction } from "@/lib/actions/model";

const BOARD_ORDER: RoadmapStage[] = ["in_progress", "planned", "shipped"];
const label = "font-label text-[10.5px] uppercase tracking-[0.18em]";
const line = "color-mix(in srgb, currentColor 14%, transparent)";
const soft = "color-mix(in srgb, currentColor 6%, transparent)";
const month = (iso: string) => new Date(iso).toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" });
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * What the owner is building, on their Creator or Business page. It sits inside any Appearance:
 * colour comes from currentColor and the page accent, never a fixed palette.
 */
export function PublicBuilder({ projects, images, actions, actionHref, accent, accentInk }: {
  projects: PublicProject[];
  images: Record<string, string | null>;
  actions: PublicAction[];
  actionHref?: (id: string) => string;
  accent: string;
  accentInk: string;
}) {
  if (!projects.length) return null;
  const actionById = new Map(actions.map((action) => [action.id, action]));
  return (
    <section aria-label="What I'm building" className="flex flex-col gap-4 text-left" data-builder-projects={projects.length}>
      <p className={`${label} opacity-60`}>Building</p>
      {projects.map((project) => {
        const cover = project.cover_block_id ? images[project.cover_block_id] ?? null : null;
        const logo = project.logo_block_id ? images[project.logo_block_id] ?? null : null;
        const stages = byStage(project.roadmap);
        const linked = project.action_ids.map((id) => actionById.get(id)).filter((item): item is PublicAction => Boolean(item));
        const url = safeHttps(project.url);
        return (
          <article className="overflow-hidden rounded-[var(--sv-card-r,22px)]" data-project={project.slug} key={project.id} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
            {cover && <div className="aspect-[16/7] w-full bg-cover bg-center" role="img" aria-label={`${project.name} cover`} style={{ backgroundImage: `url("${cover}")` }} />}
            <div className="flex flex-col gap-4 p-5">
              <header className="flex items-start gap-4">
                {logo
                  ? <span aria-hidden="true" className="size-12 shrink-0 rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url("${logo}")` }} />
                  : <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-[14px] font-display text-[22px] font-bold" style={{ background: accent, color: accentInk }}>{project.name.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-[26px] font-bold leading-[1.02] tracking-[-0.04em]">{project.name}</h3>
                    <span className={`${label} rounded-full px-2 py-0.5 text-[9.5px]`} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>{PROJECT_STATUS_LABEL[project.status]}</span>
                  </div>
                  {project.tagline && <p className="mt-1 text-[16px] leading-[1.4] opacity-80">{project.tagline}</p>}
                  <p className={`${label} mt-2 opacity-55`}>{[project.category, project.launched_on ? `Since ${month(project.launched_on)}` : null].filter(Boolean).join(" · ")}</p>
                </div>
              </header>
              {project.description && <p className="whitespace-pre-line text-[15px] leading-[1.55] opacity-80">{project.description}</p>}
              {project.tech_stack.length > 0 && <ul aria-label="Built with" className="flex flex-wrap gap-1.5">{project.tech_stack.map((tech) => <li className="rounded-full px-2.5 py-1 text-[12.5px]" key={tech} style={{ background: soft }}>{tech}</li>)}</ul>}

              {(url || linked.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {linked.map((action) => {
                    const href = actionHref?.(action.id);
                    const inner = <>{action.title}<span aria-hidden="true">→</span></>;
                    return href
                      ? <a className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold" href={href} key={action.id} style={{ background: accent, color: accentInk }} title={ctaFor(action)}>{inner}</a>
                      : <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold" key={action.id} style={{ background: accent, color: accentInk }}>{inner}</span>;
                  })}
                  {url && <a className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold" href={url} rel="noopener noreferrer" style={{ boxShadow: `inset 0 0 0 1px ${line}` }} target="_blank">Visit {new URL(url).hostname.replace(/^www\./, "")}<span aria-hidden="true">↗</span></a>}
                </div>
              )}

              {project.roadmap.length > 0 && (
                <details className="group rounded-[16px] p-4" open={project.roadmap.length <= 6} style={{ background: soft }}>
                  <summary className={`${label} flex cursor-pointer list-none items-center justify-between opacity-70`}>Roadmap<span aria-hidden="true" className="transition group-open:rotate-45">+</span></summary>
                  <div className="mt-4 grid gap-4 @min-[700px]/profile:grid-cols-3">
                    {BOARD_ORDER.map((stage) => stages[stage].length > 0 && (
                      <div className="flex flex-col gap-2" key={stage}>
                        <p className={`${label} opacity-55`}>{ROADMAP_STAGE_LABEL[stage]} · {stages[stage].length}</p>
                        <ol className="flex flex-col gap-2">
                          {stages[stage].map((item) => (
                            <li className="rounded-[12px] p-3" data-roadmap-stage={stage} key={item.id} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
                              <p className="text-[14.5px] font-semibold leading-[1.35]">{item.title}</p>
                              {item.description && <p className="mt-1 line-clamp-3 text-[13px] leading-[1.45] opacity-70">{item.description}</p>}
                              {stage === "in_progress" && item.progress > 0 && (
                                <div aria-label={`${item.progress}% done`} className="mt-2 h-1 overflow-hidden rounded-full" role="img" style={{ background: line }}><div className="h-full rounded-full" style={{ width: `${item.progress}%`, background: accent }} /></div>
                              )}
                              {stage === "shipped" && item.shipped_at && <p className={`${label} mt-2 text-[9.5px] opacity-55`}>Shipped {dayMonth(item.shipped_at)}</p>}
                              {stage !== "shipped" && item.target_date && <p className={`${label} mt-2 text-[9.5px] opacity-55`}>Target {month(item.target_date)}</p>}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {project.updates.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className={`${label} opacity-55`}>Updates</p>
                  <ol className="flex flex-col gap-3">{project.updates.map((update) => (
                    <li className="border-l-2 pl-3" key={update.id} style={{ borderColor: accent }}>
                      <p className={`${label} text-[9.5px] opacity-55`}>{dayMonth(update.published_at)}</p>
                      <p className="text-[15px] font-semibold">{update.title}</p>
                      {update.body && <p className="mt-1 whitespace-pre-line text-[14px] leading-[1.5] opacity-75">{update.body}</p>}
                    </li>
                  ))}</ol>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
