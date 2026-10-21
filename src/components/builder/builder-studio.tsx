"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { coralButton, inkButton, lineButton, Mono } from "@/components/creator/studio-ui";
import { reviewBuilderSuggestion } from "@/lib/builder/actions";
import { builderError, insightsCsv, parseStack, projectSlug, PROJECT_STATUS_LABEL, PROJECT_STATUSES, ROADMAP_STAGE_LABEL, ROADMAP_STAGES, type BuilderInsights, type BuilderLimits, type BuilderProject, type BuilderSuggestion, type ProjectStatus, type ProjectUpdate, type RoadmapItem, type RoadmapStage } from "@/lib/builder/model";
import { createClient } from "@/lib/supabase/client";

const field = "min-h-12 w-full rounded-[16px] bg-white px-4 text-[16px] shadow-[inset_0_0_0_1px_rgba(13,13,13,.14)] outline-none focus:shadow-[inset_0_0_0_1.5px_#0D0D0D]";
const area = `${field} min-h-28 py-3`;
const card = "rounded-[24px] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)]";

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
      <nav aria-label="Projects" className="flex flex-col gap-2">
        {props.projects.map((p) => (
          <button className={`flex min-h-12 items-center justify-between gap-2 rounded-[16px] px-4 text-left text-[15px] font-semibold transition ${!creating && current === p.id ? "bg-[#0D0D0D] text-white" : "bg-white shadow-[inset_0_0_0_1px_rgba(13,13,13,.08)] hover:shadow-[inset_0_0_0_1.5px_#0D0D0D]"}`} key={p.id} onClick={() => pick(p.id)} type="button">
            <span className="truncate">{p.name}</span><span className="shrink-0 text-[12px] font-normal opacity-60">{p.visibility === "public" ? PROJECT_STATUS_LABEL[p.status] : "Draft"}</span>
          </button>
        ))}
        <button className={lineButton} onClick={() => pick(null)} type="button"><span aria-hidden="true">+</span>New project</button>
        <p className="px-1 text-[13px] text-black/55">{publicCount} of {props.limits.public_projects} public on {props.limits.plan === "free" ? "Free" : props.limits.plan === "plus" ? "Plus" : "Pro"}</p>
      </nav>

      <div className="grid content-start gap-6">
        <section aria-label="Project" className={`${card} grid gap-4`}>
          <Mono className="text-black/55">{project ? "Project" : "New project"}</Mono>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2"><span className="text-[14px] font-semibold">Name</span><input className={field} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="My SaaS" value={draft.name} /></label>
            <label className="grid gap-2"><span className="text-[14px] font-semibold">Status</span>
              <select className={field} onChange={(e) => set("status", e.target.value as ProjectStatus)} value={draft.status}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}</select></label>
          </div>
          <label className="grid gap-2"><span className="text-[14px] font-semibold">One line pitch</span><input className={field} maxLength={140} onChange={(e) => set("tagline", e.target.value)} placeholder="Invoices that chase themselves" value={draft.tagline} /></label>
          <label className="grid gap-2"><span className="text-[14px] font-semibold">About</span><textarea className={area} maxLength={2000} onChange={(e) => set("description", e.target.value)} value={draft.description} /></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2"><span className="text-[14px] font-semibold">Website</span><input className={field} inputMode="url" maxLength={300} onChange={(e) => set("url", e.target.value)} placeholder="https://mysaas.com" value={draft.url} /></label>
            <label className="grid gap-2"><span className="text-[14px] font-semibold">Category</span><input className={field} maxLength={40} onChange={(e) => set("category", e.target.value)} placeholder="Fintech · B2B SaaS" value={draft.category} /></label>
            <label className="grid gap-2"><span className="text-[14px] font-semibold">Built with</span><input className={field} onChange={(e) => set("stack", e.target.value)} placeholder="Next.js, Postgres, Stripe" value={draft.stack} /></label>
            <label className="grid gap-2"><span className="text-[14px] font-semibold">Launched</span><input className={field} onChange={(e) => set("launched_on", e.target.value)} type="date" value={draft.launched_on} /></label>
          </div>
          {props.images.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {(["logo_block_id", "cover_block_id"] as const).map((key) => (
                <label className="grid gap-2" key={key}><span className="text-[14px] font-semibold">{key === "logo_block_id" ? "Logo" : "Cover"}</span>
                  <select className={field} onChange={(e) => set(key, e.target.value)} value={draft[key]}><option value="">None</option>{props.images.map((image) => <option key={image.id} value={image.id}>{image.title}</option>)}</select></label>
              ))}
              <p className="text-[13px] text-black/55 md:col-span-2">Images come from this Mode&apos;s pictures.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="flex items-center gap-3 text-[15px]"><input checked={draft.visibility === "public"} className="size-5 accent-[#0D0D0D]" onChange={(e) => set("visibility", e.target.checked ? "public" : "draft")} type="checkbox" />Show on my page</label>
            <label className="flex items-center gap-3 text-[15px]"><input checked={draft.roadmap_public} className="size-5 accent-[#0D0D0D]" onChange={(e) => set("roadmap_public", e.target.checked)} type="checkbox" />Public roadmap</label>
            <label className="flex items-center gap-3 text-[15px]"><input checked={draft.voting_enabled} className="size-5 accent-[#0D0D0D]" onChange={(e) => set("voting_enabled", e.target.checked)} type="checkbox" />Voting</label>
            <label className={`flex items-center gap-3 text-[15px] ${props.limits.suggestions ? "" : "opacity-55"}`}><input checked={draft.suggestions_enabled && Boolean(props.limits.suggestions)} className="size-5 accent-[#0D0D0D]" disabled={!props.limits.suggestions} onChange={(e) => set("suggestions_enabled", e.target.checked)} type="checkbox" />Suggestions{!props.limits.suggestions && <span className="text-[13px]">· Plus</span>}</label>
          </div>
          {error && <p className="rounded-[14px] bg-[#FFE9E7] px-4 py-3 text-[14px] text-[#B4231A]" role="alert">{error === "That didn't save. Try again." && !draft.name.trim() ? "Give the project a name." : error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className={coralButton} disabled={pending} onClick={save} type="button">{pending ? "Saving…" : project ? "Save" : "Create project"}</button>
            {project && <button className={lineButton} disabled={pending} onClick={() => { if (window.confirm(`Delete ${project.name}, its roadmap and updates?`)) run(async () => { const r = await supabase.from("builder_projects").delete().eq("id", project.id); if (!r.error) pick(props.projects.find((p) => p.id !== project.id)?.id ?? null); return r; }, "Deleted."); }} type="button">Delete</button>}
            {saved && <span className="text-[14px] text-black/60" role="status">{saved}</span>}
          </div>
        </section>

        {project && <Roadmap items={items} limit={props.limits.roadmap_items} onRun={run} ownerId={props.ownerId} pending={pending} projectId={project.id} supabase={supabase} />}
        {project && <Inbox onRun={run} pending={pending} suggestions={props.suggestions.filter((item) => item.project_id === project.id)} />}
        {project && props.insights[project.id] && <Insights data={props.insights[project.id]!} projectName={project.name} />}
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

type Run = (work: () => Promise<{ error: { message: string } | null } | void>, done?: string) => void;
type Client = ReturnType<typeof createClient>;

function Roadmap({ items, projectId, ownerId, supabase, onRun, pending, limit }: { items: (RoadmapItem & { project_id: string })[]; projectId: string; ownerId: string; supabase: Client; onRun: Run; pending: boolean; limit: number }) {
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<RoadmapStage>("planned");
  const add = () => { if (!title.trim()) return; onRun(async () => { const r = await supabase.from("builder_roadmap_items").insert({ project_id: projectId, owner_user_id: ownerId, title: title.trim().slice(0, 100), stage, sort_order: items.length }); if (!r.error) setTitle(""); return r; }, "Added."); };
  return (
    <section aria-label="Roadmap" className={`${card} grid gap-4`}>
      <div className="flex items-baseline justify-between"><Mono className="text-black/55">Roadmap</Mono><span className="text-[13px] text-black/50">{items.length} of {limit}</span></div>
      <div className="grid gap-4 md:grid-cols-3">
        {ROADMAP_STAGES.map((s) => (
          <div className="grid content-start gap-2 rounded-[18px] bg-[#F5F4EF] p-3" key={s}>
            <Mono className="text-black/55">{ROADMAP_STAGE_LABEL[s]}</Mono>
            {items.filter((item) => item.stage === s).map((item) => (
              <div className="grid gap-2 rounded-[14px] bg-white p-3" key={item.id}>
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
      <div className="flex flex-wrap gap-2">
        <input aria-label="New roadmap item" className={`${field} flex-1`} maxLength={100} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Next up: Stripe sync" value={title} />
        <select aria-label="Stage for the new item" className={`${field} w-auto`} onChange={(e) => setStage(e.target.value as RoadmapStage)} value={stage}>{ROADMAP_STAGES.map((x) => <option key={x} value={x}>{ROADMAP_STAGE_LABEL[x]}</option>)}</select>
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
      <Mono className="text-black/55">Updates</Mono>
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
      <div className="flex flex-wrap items-baseline justify-between gap-2"><Mono className="text-black/55">Voting</Mono><span className="text-[13px] text-black/55">{data.voters} {data.voters === 1 ? "person" : "people"} voted · {data.approved} ideas approved</span></div>
      {top.length ? <ol className="grid gap-2">{top.map((item) => (
        <li className="grid gap-1" key={item.id}><div className="flex justify-between gap-3 text-[14px]"><span className="truncate font-semibold">{item.title}</span><span className="shrink-0 tabular-nums text-black/60">{item.votes}{item.votes_30d ? ` · +${item.votes_30d} this month` : ""}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#F5F4EF]"><div className="h-full rounded-full bg-[#0D0D0D]" style={{ width: `${Math.max(4, Math.round((item.votes / top[0].votes) * 100))}%` }} /></div></li>
      ))}</ol> : <p className="text-[14px] text-black/60">No votes yet. Votes show here as members vote on planned and in-progress items.</p>}
      {data.can_export ? <div><button className={lineButton} onClick={download} type="button">Export CSV</button><p className="mt-1 text-[12.5px] text-black/50">Counts only. No voter or author is ever in the file.</p></div> : <p className="text-[13px] text-black/50">CSV export is part of Pro.</p>}
    </section>
  );
}
