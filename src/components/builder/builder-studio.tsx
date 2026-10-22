"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { coralButton, inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { reviewBuilderSuggestion } from "@/lib/builder/actions";
import { builderError, insightsCsv, parseStack, projectSlug, PROJECT_STATUS_LABEL, PROJECT_STATUSES, ROADMAP_STAGE_LABEL, ROADMAP_STAGES, type BuilderInsights, type BuilderLimits, type BuilderProject, type BuilderSuggestion, type ProjectStatus, type ProjectUpdate, type RoadmapItem, type RoadmapStage } from "@/lib/builder/model";
import { createClient } from "@/lib/supabase/client";

import { ProjectMark } from "./project-mark";
import { RevenuePanel, type RevenueConnection, type RevenueLimits, type RevenueSnapshot } from "./revenue-panel";

const field = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]";
const area = `${field} min-h-28 py-3`;
const card = "rounded-[28px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08),0_30px_60px_-50px_#0D0D0D] md:p-7";

type Props = {
  slug: "creator" | "business";
  modeId: string;
  ownerId: string;
  projects: BuilderProject[];
  roadmap: (RoadmapItem & { project_id: string })[];
  updates: (ProjectUpdate & { project_id: string })[];
  links: { project_id: string; action_id: string }[];
  actions: { id: string; title: string; status: string }[];
  images: { id: string; imageUrl: string; title: string }[];
  limits: BuilderLimits;
  selected: string | null;
  suggestions: BuilderSuggestion[];
  insights: Record<string, BuilderInsights | null>;
  revenue: { connections: RevenueConnection[]; snapshots: RevenueSnapshot[]; limits: RevenueLimits };
};

type Draft = { name: string; slug: string; tagline: string; description: string; url: string; status: ProjectStatus; category: string; stack: string; launched_on: string; logo_block_id: string; cover_block_id: string; visibility: "draft" | "public"; roadmap_public: boolean; voting_enabled: boolean; suggestions_enabled: boolean };
const toDraft = (project: BuilderProject | null): Draft => ({
  name: project?.name ?? "", slug: project?.slug ?? "", tagline: project?.tagline ?? "", description: project?.description ?? "", url: project?.url ?? "",
  status: project?.status ?? "building", category: project?.category ?? "", stack: (project?.tech_stack ?? []).join(", "), launched_on: project?.launched_on ?? "",
  logo_block_id: project?.logo_block_id ?? "", cover_block_id: project?.cover_block_id ?? "", visibility: project?.visibility ?? "draft", roadmap_public: project?.roadmap_public ?? true,
  voting_enabled: project?.voting_enabled ?? true, suggestions_enabled: project?.suggestions_enabled ?? false,
});

/** Projects on one side, the chosen project's details, roadmap, updates and Actions on the other. */
export function BuilderStudio(props: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [current, setCurrent] = useState<string | null>(props.selected && props.projects.some((p) => p.id === props.selected) ? props.selected : props.projects[0]?.id ?? null);
  const [creating, setCreating] = useState(!props.projects.length);
  const project = creating ? null : props.projects.find((p) => p.id === current) ?? null;
  const [draft, setDraft] = useState<Draft>(toDraft(project));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, start] = useTransition();
  const publicCount = props.projects.filter((p) => p.visibility === "public").length;
  const tone = props.slug === "creator" ? "#E8A6FF" : "#AFCBFF";
  const copy = STUDIO_COPY[props.slug];

  const pick = (id: string | null) => { const next = props.projects.find((p) => p.id === id) ?? null; setCreating(id === null); setCurrent(id); setDraft(toDraft(next)); setError(""); setSaved(""); };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft((prev) => ({ ...prev, [key]: value, ...(key === "name" && !project ? { slug: projectSlug(String(value)) } : {}) })); setError(""); setSaved(""); };
  const run = (work: () => Promise<{ error: { message: string } | null } | void>, done = "Saved.") => start(async () => {
    const result = await work();
    if (result && result.error) { setError(builderError(result.error.message)); return; }
    setSaved(done); router.refresh();
  });

  const save = () => run(async () => {
    if (!draft.name.trim()) return { error: { message: "name" } };
    const row = {
      name: draft.name.trim(), slug: projectSlug(draft.slug || draft.name), tagline: draft.tagline.trim(), description: draft.description.trim(),
      url: draft.url.trim() ? (draft.url.trim().startsWith("https://") ? draft.url.trim() : `https://${draft.url.trim().replace(/^http:\/\//, "")}`) : null,
      status: draft.status, category: draft.category.trim(), tech_stack: parseStack(draft.stack), launched_on: draft.launched_on || null,
      logo_block_id: draft.logo_block_id || null, cover_block_id: draft.cover_block_id || null, visibility: draft.visibility, roadmap_public: draft.roadmap_public,
      voting_enabled: draft.voting_enabled, suggestions_enabled: draft.suggestions_enabled && Boolean(props.limits.suggestions),
    };
    if (project) return supabase.from("builder_projects").update(row).eq("id", project.id);
    const created = await supabase.from("builder_projects").insert({ ...row, owner_user_id: props.ownerId, mode_id: props.modeId, sort_order: props.projects.length }).select("id").single();
    if (!created.error) { setCreating(false); setCurrent(created.data.id); router.replace(props.slug === "creator" ? `/app/identity/creator/builder?project=${created.data.id}` : `/app/identity/builder?mode=business&project=${created.data.id}`); }
    return { error: created.error };
  });

  const items = project ? props.roadmap.filter((item) => item.project_id === project.id) : [];
  const posts = project ? props.updates.filter((item) => item.project_id === project.id) : [];
  const linked = new Set(project ? props.links.filter((link) => link.project_id === project.id).map((link) => link.action_id) : []);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Projects" className="flex flex-col gap-2 lg:sticky lg:top-24 lg:self-start">
        <Mono className="px-1 text-black/45">Your projects</Mono>
        {props.projects.map((p) => {
          const on = !creating && current === p.id;
          return (
            <button className={`group flex min-h-[64px] items-center gap-3 rounded-[18px] p-2.5 pr-3.5 text-left transition ${on ? "bg-[#0D0D0D] text-[#F5F4EF] shadow-[0_18px_34px_-22px_#0D0D0D]" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] hover:-translate-y-px hover:shadow-[inset_0_0_0_1px_rgba(13,13,13,.16),0_14px_28px_-24px_#0D0D0D]"}`} key={p.id} onClick={() => pick(p.id)} type="button">
              <ProjectMark accent={tone} accentInk="#0D0D0D" name={p.name} size={42} url={p.url} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{p.name}</span>
                <span className={`flex items-center gap-1.5 text-[12px] ${on ? "text-[#F5F4EF]/60" : "text-black/50"}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${p.visibility === "public" ? "bg-[#3BD17A]" : "bg-current opacity-50"}`} />{p.visibility === "public" ? `Public · ${PROJECT_STATUS_LABEL[p.status]}` : "Draft"}</span></span>
            </button>
          );
        })}
        <button className={`flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed text-[14.5px] font-semibold transition ${creating ? "border-[#0D0D0D] bg-white" : "border-black/15 text-black/60 hover:border-black/40 hover:text-black"}`} onClick={() => pick(null)} type="button"><span aria-hidden="true" className="text-[18px] leading-none">+</span>New project</button>
        <div className="mt-1 px-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (publicCount / Math.max(1, props.limits.public_projects)) * 100)}%`, background: tone }} /></div>
          <p className="mt-1.5 text-[12.5px] text-black/50">{publicCount} of {props.limits.public_projects} public on {props.limits.plan === "free" ? "Free" : props.limits.plan === "plus" ? "Plus" : "Pro"}</p>
        </div>
      </nav>

      <div className="grid content-start gap-6">
        <section aria-label="Project" className="overflow-hidden rounded-[28px] bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08),0_30px_60px_-50px_#0D0D0D]">
          {/* Live preview: what visitors see at the top of the card, as you type. */}
          <div className="relative isolate overflow-hidden bg-[#0D0D0D] px-5 py-6 text-[#F5F4EF] md:px-7" data-builder-preview>
            <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full opacity-70 blur-2xl" style={{ background: `radial-gradient(circle, ${tone}70, transparent 65%)` }} />
            <div className="flex items-center gap-4">
              <ProjectMark accent={tone} accentInk="#0D0D0D" name={draft.name || "?"} size={60} url={draft.url ? (draft.url.startsWith("http") ? draft.url : `https://${draft.url}`) : null} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-display text-[28px] font-bold leading-none tracking-[-0.045em] md:text-[34px]">{draft.name || "Untitled project"}</p>
                  <span className="rounded-full px-2 py-0.5 font-label text-[9.5px] uppercase tracking-[0.16em] shadow-[inset_0_0_0_1px_rgba(245,244,239,.25)]">{PROJECT_STATUS_LABEL[draft.status]}</span>
                </div>
                <p className="mt-1.5 truncate text-[14.5px] text-[#F5F4EF]/65">{draft.tagline || "Your one line pitch shows here."}</p>
              </div>
              <span className={`ml-auto hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold sm:flex ${draft.visibility === "public" ? "bg-[#3BD17A]/15 text-[#7BE8A6]" : "bg-[#F5F4EF]/10 text-[#F5F4EF]/60"}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${draft.visibility === "public" ? "bg-[#3BD17A]" : "bg-[#F5F4EF]/50"}`} />{draft.visibility === "public" ? "On your page" : "Draft"}</span>
            </div>
          </div>

          <div className="grid gap-7 p-5 md:p-7">
            <Group title="The basics">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <Field label="Name"><input className={field} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder={copy.name} value={draft.name} /></Field>
                <Field label="Status"><select className={field} onChange={(e) => set("status", e.target.value as ProjectStatus)} value={draft.status}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}</select></Field>
              </div>
              <Field label="One line pitch" hint={`${draft.tagline.length}/140`}><input className={field} maxLength={140} onChange={(e) => set("tagline", e.target.value)} placeholder={copy.pitch} value={draft.tagline} /></Field>
              <Field label="About"><textarea className={area} maxLength={2000} onChange={(e) => set("description", e.target.value)} placeholder={copy.about} value={draft.description} /></Field>
            </Group>

            <Group title="Details">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Website" hint="Its icon becomes the logo"><input className={field} inputMode="url" maxLength={300} onChange={(e) => set("url", e.target.value)} placeholder={copy.url} value={draft.url} /></Field>
                <Field label="Category"><input className={field} maxLength={40} onChange={(e) => set("category", e.target.value)} placeholder={copy.category} value={draft.category} /></Field>
                <Field label={copy.stackLabel}><input className={field} onChange={(e) => set("stack", e.target.value)} placeholder={copy.stack} value={draft.stack} /></Field>
                <Field label={copy.launchedLabel}><input className={field} onChange={(e) => set("launched_on", e.target.value)} type="date" value={draft.launched_on} /></Field>
              </div>
              {parseStack(draft.stack).length > 0 && <ul aria-label="Built with" className="flex flex-wrap gap-1.5">{parseStack(draft.stack).map((tech) => <li className="rounded-full bg-[#F5F4EF] px-3 py-1 text-[12.5px] font-semibold" key={tech}>{tech}</li>)}</ul>}
            </Group>

            {props.images.length > 0 && (
              <Group title="Images" note="From this Mode's pictures.">
                <div className="grid gap-4 md:grid-cols-2">
                  {(["logo_block_id", "cover_block_id"] as const).map((key) => (
                    <Field key={key} label={key === "logo_block_id" ? "Logo" : "Cover"}>
                      <select className={field} onChange={(e) => set(key, e.target.value)} value={draft[key]}><option value="">{key === "logo_block_id" ? "Website icon" : "None"}</option>{props.images.map((image) => <option key={image.id} value={image.id}>{image.title}</option>)}</select>
                    </Field>
                  ))}
                </div>
              </Group>
            )}

            <Group title="On your page">
              <div className="grid gap-2 md:grid-cols-2">
                <Switch checked={draft.visibility === "public"} label="Show on my page" note="Visitors see this project" onChange={(on) => set("visibility", on ? "public" : "draft")} />
                <Switch checked={draft.roadmap_public} label="Public roadmap" note="Planned, in progress and shipped" onChange={(on) => set("roadmap_public", on)} />
                <Switch checked={draft.voting_enabled} label="Voting" note="Members vote on what's next" onChange={(on) => set("voting_enabled", on)} />
                <Switch checked={draft.suggestions_enabled && Boolean(props.limits.suggestions)} disabled={!props.limits.suggestions} label="Suggestions" note={props.limits.suggestions ? "Members send ideas you approve" : "Part of Plus"} onChange={(on) => set("suggestions_enabled", on)} />
              </div>
            </Group>

            {error && <p className="rounded-[14px] bg-[#FFE9E7] px-4 py-3 text-[14px] text-[#B4231A]" role="alert">{error === "That didn't save. Try again." && !draft.name.trim() ? "Give the project a name." : error}</p>}
          </div>
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-black/[0.07] bg-white/90 px-5 py-4 backdrop-blur md:px-7">
            <button className={coralButton} disabled={pending} onClick={save} type="button">{pending ? "Saving…" : project ? "Save changes" : "Create project"}</button>
            {saved && <span className="flex items-center gap-1.5 text-[14px] text-black/60" role="status"><span aria-hidden="true" className="text-[#3BD17A]">●</span>{saved}</span>}
            {project && <button className="ml-auto text-[14px] font-semibold text-black/45 transition hover:text-[#B4231A]" disabled={pending} onClick={() => { if (window.confirm(`Delete ${project.name}, its roadmap and updates?`)) run(async () => { const r = await supabase.from("builder_projects").delete().eq("id", project.id); if (!r.error) pick(props.projects.find((p) => p.id !== project.id)?.id ?? null); return r; }, "Deleted."); }} type="button">Delete project</button>}
          </div>
        </section>

        {project && <Roadmap items={items} placeholder={copy.next} limit={props.limits.roadmap_items} onRun={run} ownerId={props.ownerId} pending={pending} projectId={project.id} supabase={supabase} />}
        {project && <Inbox onRun={run} pending={pending} suggestions={props.suggestions.filter((item) => item.project_id === project.id)} />}
        {project && props.insights[project.id] && <Insights data={props.insights[project.id]!} projectName={project.name} />}
        {project && <RevenuePanel connections={props.revenue.connections} limits={props.revenue.limits} projectId={project.id} snapshots={props.revenue.snapshots} visibility={project.revenue_visibility ?? "hidden"} />}
        {project && <Updates onRun={run} ownerId={props.ownerId} pending={pending} posts={posts} projectId={project.id} supabase={supabase} />}
        {project && props.actions.length > 0 && (
          <section aria-label="Actions on this project" className={`${card} grid gap-3`}>
            <Mono className="text-black/55">Actions with this project</Mono>
            <p className="text-[14px] text-black/60">Live ones show as buttons on the project, like a waitlist or beta sign-up.</p>
            <ul className="grid gap-2">{props.actions.filter((action) => action.status !== "archived").map((action) => (
              <li key={action.id}><label className="flex items-center gap-3 text-[15px]">
                <input checked={linked.has(action.id)} className="size-5 accent-[#0D0D0D]" disabled={pending} onChange={(e) => run(async () => e.target.checked
                  ? supabase.from("builder_project_actions").insert({ project_id: project.id, action_id: action.id, owner_user_id: props.ownerId })
                  : supabase.from("builder_project_actions").delete().eq("project_id", project.id).eq("action_id", action.id))} type="checkbox" />
                {action.title}<span className="text-[13px] text-black/50">{action.status === "published" ? "Live" : "Draft"}</span>
              </label></li>
            ))}</ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** Examples that fit the Mode: a creator builds shows, courses and drops; a business builds products. */
const STUDIO_COPY = {
  creator: { name: "My podcast", pitch: "A weekly show about cities and food", about: "What you're making, who it's for, and where it's headed.", url: "https://myshow.com", category: "Podcast · Course · Newsletter", stackLabel: "Made with", stack: "Riverside, Notion, Figma", launchedLabel: "Started", next: "Next up: season two" },
  business: { name: "My SaaS", pitch: "Invoices that chase themselves", about: "What it does, who it's for, and why you're building it.", url: "https://mysaas.com", category: "Fintech · B2B SaaS", stackLabel: "Built with", stack: "Next.js, Postgres, Stripe", launchedLabel: "Launched", next: "Next up: Stripe sync" },
} as const;

const STAGE_DOT: Record<RoadmapStage, string> = { planned: "#B8B4AA", in_progress: "#FF5A4F", shipped: "#7AD14A" };

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-3 flex w-full items-baseline justify-between gap-3"><span className="font-display text-[19px] font-bold tracking-[-0.03em]">{title}</span>{note && <span className="text-[12.5px] text-black/50">{note}</span>}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="flex items-baseline justify-between gap-2 text-[13px] font-semibold text-black/75">{label}{hint && <span className="text-[11.5px] font-normal text-black/45">{hint}</span>}</span>{children}</label>;
}

function Switch({ checked, label, note, onChange, disabled = false }: { checked: boolean; label: string; note: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button aria-checked={checked} className={`flex min-h-[60px] items-center justify-between gap-3 rounded-[16px] bg-[#F5F4EF] px-4 text-left transition ${disabled ? "opacity-55" : "hover:bg-[#EEEDE7]"}`} disabled={disabled} onClick={() => onChange(!checked)} role="switch" type="button">
      <span className="min-w-0"><span className="block text-[14.5px] font-semibold">{label}</span><span className="block truncate text-[12.5px] text-black/55">{note}</span></span>
      <span aria-hidden="true" className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${checked ? "bg-[#0D0D0D]" : "bg-black/15"}`}><span className={`absolute top-[3px] size-5 rounded-full bg-white shadow-[0_1px_3px_#0D0D0D40] transition-[left] ${checked ? "left-[21px]" : "left-[3px]"}`} /></span>
    </button>
  );
}

type Run = (work: () => Promise<{ error: { message: string } | null } | void>, done?: string) => void;
type Client = ReturnType<typeof createClient>;

function Roadmap({ items, projectId, ownerId, supabase, onRun, pending, limit, placeholder }: { items: (RoadmapItem & { project_id: string })[]; projectId: string; ownerId: string; supabase: Client; onRun: Run; pending: boolean; limit: number; placeholder: string }) {
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<RoadmapStage>("planned");
  const add = () => { if (!title.trim()) return; onRun(async () => { const r = await supabase.from("builder_roadmap_items").insert({ project_id: projectId, owner_user_id: ownerId, title: title.trim().slice(0, 100), stage, sort_order: items.length }); if (!r.error) setTitle(""); return r; }, "Added."); };
  return (
    <section aria-label="Roadmap" className={`${card} grid gap-4`}>
      <div className="flex items-end justify-between gap-3"><div><Mono className="text-black/45">Roadmap</Mono><h2 className="mt-1 font-display text-[26px] font-bold tracking-[-0.04em]">What&apos;s next</h2></div><span className="text-[13px] text-black/50">{items.length} of {limit}</span></div>
      <div className="grid gap-3 md:grid-cols-3">
        {ROADMAP_STAGES.map((s) => (
          <div className="grid min-h-[140px] content-start gap-2 rounded-[20px] bg-[#F5F4EF] p-3" key={s}>
            <div className="flex items-center justify-between px-1 py-0.5"><span className="flex items-center gap-2"><span aria-hidden="true" className="size-2 rounded-full" style={{ background: STAGE_DOT[s] }} /><span className="text-[13px] font-semibold">{ROADMAP_STAGE_LABEL[s]}</span></span><span className="font-label text-[11px] text-black/45">{items.filter((item) => item.stage === s).length}</span></div>
            {items.filter((item) => item.stage === s).map((item) => (
              <div className="grid gap-2 rounded-[16px] bg-white p-3.5 shadow-[0_1px_0_rgba(13,13,13,.04),0_10px_24px_-20px_#0D0D0D]" key={item.id}>
                <p className="text-[14.5px] font-semibold">{item.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Stage" className="min-h-9 rounded-full bg-[#F5F4EF] px-3 text-[13px]" disabled={pending} onChange={(e) => onRun(async () => supabase.from("builder_roadmap_items").update({ stage: e.target.value }).eq("id", item.id))} value={item.stage}>{ROADMAP_STAGES.map((x) => <option key={x} value={x}>{ROADMAP_STAGE_LABEL[x]}</option>)}</select>
                  {item.stage === "in_progress" && <select aria-label="Progress" className="min-h-9 rounded-full bg-[#F5F4EF] px-3 text-[13px]" disabled={pending} onChange={(e) => onRun(async () => supabase.from("builder_roadmap_items").update({ progress: Number(e.target.value) }).eq("id", item.id))} value={item.progress}>{[0, 10, 25, 50, 75, 90].map((n) => <option key={n} value={n}>{n}%</option>)}</select>}
                  <label className="flex items-center gap-1.5 text-[13px] text-black/60"><input checked={item.is_public !== false} disabled={pending} onChange={(e) => onRun(async () => supabase.from("builder_roadmap_items").update({ is_public: e.target.checked }).eq("id", item.id))} type="checkbox" />Public</label>
                  <button className="ml-auto text-[13px] text-black/45 hover:text-black" disabled={pending} onClick={() => onRun(async () => supabase.from("builder_roadmap_items").delete().eq("id", item.id), "Removed.")} type="button">Remove</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
        <input aria-label="New roadmap item" className={field} maxLength={100} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} value={title} />
        <select aria-label="Stage for the new item" className={field} onChange={(e) => setStage(e.target.value as RoadmapStage)} value={stage}>{ROADMAP_STAGES.map((x) => <option key={x} value={x}>{ROADMAP_STAGE_LABEL[x]}</option>)}</select>
        <button className={inkButton} disabled={pending || !title.trim()} onClick={add} type="button">Add</button>
      </div>
      <p className="text-[13px] text-black/55">Shipped items form the project&apos;s changelog, newest first.</p>
    </section>
  );
}

function Updates({ posts, projectId, ownerId, supabase, onRun, pending }: { posts: (ProjectUpdate & { project_id: string })[]; projectId: string; ownerId: string; supabase: Client; onRun: Run; pending: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const post = () => { if (!title.trim()) return; onRun(async () => { const r = await supabase.from("builder_project_updates").insert({ project_id: projectId, owner_user_id: ownerId, title: title.trim().slice(0, 100), body: body.trim().slice(0, 4000) }); if (!r.error) { setTitle(""); setBody(""); } return r; }, "Posted."); };
  return (
    <section aria-label="Updates" className={`${card} grid gap-3`}>
      <div><Mono className="text-black/45">Updates</Mono><h2 className="mt-1 font-display text-[26px] font-bold tracking-[-0.04em]">Tell people what changed</h2></div>
      <input aria-label="Update title" className={field} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Beta is open" value={title} />
      <textarea aria-label="Update" className={area} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="What changed, in a few lines." value={body} />
      <div><button className={inkButton} disabled={pending || !title.trim()} onClick={post} type="button">Post update</button></div>
      {posts.length > 0 && <ol className="grid gap-2">{posts.map((p) => (
        <li className="flex items-start justify-between gap-3 rounded-[14px] bg-[#F5F4EF] p-3" key={p.id}><span><span className="block text-[14.5px] font-semibold">{p.title}</span><span className="text-[13px] text-black/55">{new Date(p.published_at).toLocaleDateString()}</span></span>
          <button className="text-[13px] text-black/45 hover:text-black" disabled={pending} onClick={() => onRun(async () => supabase.from("builder_project_updates").delete().eq("id", p.id), "Removed.")} type="button">Remove</button></li>
      ))}</ol>}
    </section>
  );
}

function Inbox({ suggestions, onRun, pending }: { suggestions: BuilderSuggestion[]; onRun: Run; pending: boolean }) {
  const open = suggestions.filter((item) => item.status === "pending");
  const done = suggestions.filter((item) => item.status !== "pending").slice(0, 10);
  if (!suggestions.length) return null;
  const decide = (id: string, approve: boolean, add: boolean) => onRun(async () => { const r = await reviewBuilderSuggestion(id, approve, add); return r.ok ? undefined : { error: { message: r.error } }; }, approve ? "Approved." : "Declined.");
  return (
    <section aria-label="Suggestions" className={`${card} grid gap-3`}>
      <div className="flex items-baseline justify-between"><Mono className="text-black/55">Suggestions</Mono><span className="text-[13px] text-black/50">{open.length} waiting</span></div>
      <p className="text-[14px] text-black/60">Private until you approve. Approving adds the idea to Planned; its author can follow it.</p>
      <ul className="grid gap-2">{open.map((item) => (
        <li className="grid gap-2 rounded-[16px] bg-[#F5F4EF] p-4" key={item.id}>
          <p className="text-[15px] font-semibold">{item.title}</p>{item.body && <p className="whitespace-pre-line text-[14px] text-black/70">{item.body}</p>}
          <div className="flex flex-wrap gap-2"><button className={inkButton} disabled={pending} onClick={() => decide(item.id, true, true)} type="button">Add to roadmap</button><button className={lineButton} disabled={pending} onClick={() => decide(item.id, true, false)} type="button">Approve only</button><button className={lineButton} disabled={pending} onClick={() => decide(item.id, false, false)} type="button">Decline</button></div>
        </li>
      ))}</ul>
      {done.length > 0 && <ul className="grid gap-1 text-[13px] text-black/55">{done.map((item) => <li key={item.id}>{item.title} · {item.status === "approved" ? "Approved" : "Declined"}</li>)}</ul>}
    </section>
  );
}

function Insights({ data, projectName }: { data: BuilderInsights; projectName: string }) {
  const top = data.items.filter((item) => item.votes > 0).slice(0, 8);
  const download = () => { const blob = new Blob([insightsCsv(projectName, data)], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${projectSlug(projectName)}-votes.csv`; a.click(); URL.revokeObjectURL(url); };
  return (
    <section aria-label="Voting insights" className={`${card} grid gap-3`}>
      <div className="flex flex-wrap items-end justify-between gap-2"><div><Mono className="text-black/45">Voting</Mono><h2 className="mt-1 font-display text-[26px] font-bold tracking-[-0.04em]">What people want</h2></div><span className="text-[13px] text-black/55">{data.voters} {data.voters === 1 ? "person" : "people"} voted · {data.approved} ideas approved</span></div>
      {top.length ? <ol className="grid gap-2">{top.map((item) => (
        <li className="grid gap-1" key={item.id}><div className="flex justify-between gap-3 text-[14px]"><span className="truncate font-semibold">{item.title}</span><span className="shrink-0 tabular-nums text-black/60">{item.votes}{item.votes_30d ? ` · +${item.votes_30d} this month` : ""}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F5F4EF]"><div className="h-full rounded-full bg-[#0D0D0D]" style={{ width: `${Math.max(4, Math.round((item.votes / top[0].votes) * 100))}%` }} /></div></li>
      ))}</ol> : <p className="text-[14px] text-black/60">No votes yet. Votes show here as members vote on planned and in-progress items.</p>}
      {data.can_export ? <div><button className={lineButton} onClick={download} type="button">Export CSV</button><p className="mt-1 text-[12.5px] text-black/50">Counts only. No voter or author is ever in the file.</p></div> : <p className="text-[13px] text-black/50">CSV export is part of Pro.</p>}
    </section>
  );
}
