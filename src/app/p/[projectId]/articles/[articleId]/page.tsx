import { notFound } from "next/navigation";
import {
  addSource, approveArticle, backToDraft, checkQuality, deleteArticle, publishArticle, refreshPublishStatus,
  rejectArticle, removeSource, saveArticle, submitForReview,
} from "@/app/actions/articles";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Notice, inputClass, labelClass } from "@/components/ui";
import { canEdit, requireProject } from "@/lib/auth";
import { buildMarkdown } from "@/lib/content/publish";

type Check = { id: string; category: string; points: number; max: number; passed: boolean; message: string };

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ projectId: string; articleId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId, articleId } = await params;
  const flash = await searchParams;
  const { supabase, role } = await requireProject(projectId);
  const [{ data: article }, { data: sources }, { data: audit }, { data: brand }] = await Promise.all([
    supabase.from("articles").select("*").eq("id", articleId).eq("project_id", projectId).maybeSingle(),
    supabase.from("article_sources").select("*").eq("article_id", articleId).order("created_at"),
    supabase.from("seo_audits").select("*").eq("article_id", articleId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("brand_profiles").select("min_quality_score").eq("project_id", projectId).maybeSingle(),
  ]);
  if (!article) notFound();

  const editable = canEdit(role) && !["pr_open", "published"].includes(article.status);
  const isOwner = role === "owner";
  const minScore = brand?.min_quality_score ?? 70;
  const checks = (audit?.checks ?? []) as Check[];
  const scoreCurrent = article.quality_score != null;
  let preview = "";
  let previewError = "";
  try {
    preview = buildMarkdown(article);
  } catch (error) {
    previewError = error instanceof Error ? error.message : String(error);
  }
  const act = <A extends unknown[]>(fn: (projectId: string, articleId: string, ...rest: A) => unknown) => fn.bind(null, projectId, articleId) as never;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{article.title}</h1>
          <p className="text-sm text-slate-500">Target keyword: {article.target_keyword} · /blog/{article.slug}</p>
        </div>
        <div className="flex items-center gap-2"><Badge value={article.status} />{scoreCurrent ? <span className="text-sm font-semibold">{article.quality_score}/100</span> : <span className="text-sm text-slate-400">not scored</span>}</div>
      </div>
      <Notice notice={flash.notice} error={flash.error} />
      {article.status === "rejected" && article.rejection_reason ? <Notice error={`Rejected: ${article.rejection_reason}`} /> : null}

      <Card title="Workflow">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit(role) && ["draft", "rejected"].includes(article.status) ? (
            <>
              <form action={act(checkQuality)}><SubmitButton variant="secondary" pending="Checking…">Run quality check</SubmitButton></form>
              <form action={act(submitForReview)}><SubmitButton pending="Submitting…">Submit for review</SubmitButton></form>
              <span className="text-xs text-slate-500">Needs a current score of {minScore}+ with no blocking issues.</span>
            </>
          ) : null}
          {article.status === "in_review" && isOwner ? (
            <>
              <form action={act(approveArticle)}><SubmitButton pending="Approving…">Approve</SubmitButton></form>
              <form action={act(rejectArticle)} className="flex gap-2">
                <input className={inputClass} name="reason" placeholder="Reason for rejecting" />
                <SubmitButton variant="danger">Reject</SubmitButton>
              </form>
            </>
          ) : null}
          {article.status === "in_review" && !isOwner ? <span className="text-sm text-slate-600">Waiting for an owner to approve.</span> : null}
          {article.status === "approved" && isOwner ? <form action={act(publishArticle)}><SubmitButton pending="Opening pull request…">Publish (open pull request)</SubmitButton></form> : null}
          {article.status === "approved" && !isOwner ? <span className="text-sm text-slate-600">Approved. An owner can publish it.</span> : null}
          {["in_review", "approved"].includes(article.status) && canEdit(role) ? <form action={act(backToDraft)}><SubmitButton variant="secondary">Back to draft</SubmitButton></form> : null}
          {article.status === "pr_open" ? (
            <>
              <a className="text-sm font-semibold text-violet-700 hover:underline" href={article.pr_url} target="_blank" rel="noreferrer">Pull request #{article.pr_number}</a>
              {isOwner ? <form action={act(refreshPublishStatus)}><SubmitButton variant="secondary" pending="Checking…">Check if merged</SubmitButton></form> : null}
            </>
          ) : null}
          {article.status === "published" ? (
            <span className="text-sm">Published {article.published_at ? new Date(article.published_at).toLocaleDateString("en-US") : ""}: <a className="font-semibold text-violet-700 hover:underline" href={article.published_url} target="_blank" rel="noreferrer">{article.published_url}</a> (live after the website deploy)</span>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Article">
          <form action={act(saveArticle)} className="grid gap-3">
            <fieldset disabled={!editable} className="grid gap-3">
              <label className={labelClass}>Title (page heading and SEO title)<input className={inputClass} name="title" defaultValue={article.title} required maxLength={200} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Slug<input className={inputClass} name="slug" defaultValue={article.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
                <label className={labelClass}>Publish date (optional)<input className={inputClass} name="scheduled_for" type="date" defaultValue={article.scheduled_for ?? ""} /></label>
              </div>
              <label className={labelClass}>Meta description (120–155 characters)<textarea className={inputClass} name="meta_description" rows={2} maxLength={160} defaultValue={article.meta_description ?? ""} /></label>
              <label className={labelClass}>Tags (comma separated)<input className={inputClass} name="tags" defaultValue={(article.tags ?? []).join(", ")} /></label>
              <label className={labelClass}>Body (Markdown — start with an intro paragraph; use ## for sections)
                <textarea className={`${inputClass} font-mono`} name="body_markdown" rows={24} defaultValue={article.body_markdown} />
              </label>
              {editable ? <div><SubmitButton pending="Saving…">Save</SubmitButton></div> : <p className="text-xs text-slate-500">Read-only{article.status === "pr_open" || article.status === "published" ? " while published or in a pull request" : ""}.</p>}
            </fieldset>
          </form>
          {editable ? (
            <form action={act(deleteArticle)} className="mt-4 border-t border-slate-100 pt-4"><SubmitButton variant="danger" pending="Deleting…">Delete article</SubmitButton></form>
          ) : null}
        </Card>

        <div className="grid content-start gap-6">
          <Card title={audit ? `Quality: ${audit.score}/100 ${audit.passed ? "· passes" : "· not ready"}` : "Quality"}>
            {audit ? (
              <>
                {!scoreCurrent ? <p className="mb-2 text-xs text-amber-700">The article changed after this check. Run it again.</p> : null}
                <ul className="grid gap-1.5 text-sm">
                  {checks.map((c, i) => (
                    <li key={`${c.id}-${i}`} className="flex gap-2">
                      <span aria-hidden className={c.passed ? "text-emerald-600" : c.max === 0 ? "text-red-600" : "text-amber-600"}>{c.passed ? "✓" : c.max === 0 ? "✕" : "!"}</span>
                      <span>{c.message}{c.max ? <span className="text-slate-400"> ({c.points}/{c.max})</span> : null}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">Rule-based checks (engine {audit.engine_version}). Fact-checking claims and judging search intent are Phase 2 (OpenAI) and are not done yet.</p>
              </>
            ) : <Empty>Not checked yet.</Empty>}
          </Card>

          <Card title={`Sources (${sources?.length ?? 0})`}>
            {sources?.length ? (
              <ul className="mb-3 grid gap-2 text-sm">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a className="break-all font-medium text-violet-700 hover:underline" href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                      {s.claim ? <p className="text-xs text-slate-500">Supports: {s.claim}</p> : null}
                      <p className="text-xs">{s.checked_at ? (s.verified ? <span className="text-emerald-700">Reachable ({s.http_status})</span> : <span className="text-red-700">Unreachable ({s.http_status ?? "no response"})</span>) : <span className="text-slate-400">Not checked</span>}</p>
                    </div>
                    {editable ? <form action={removeSource.bind(null, projectId, articleId, s.id)}><button className="text-xs text-slate-500 hover:underline">Remove</button></form> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="mb-3 text-sm text-slate-500">Add the pages that back up facts in the article.</p>}
            {editable ? (
              <form action={act(addSource)} className="grid gap-2">
                <input className={inputClass} name="url" type="url" placeholder="https://admission.org/…" required />
                <input className={inputClass} name="title" placeholder="Page title" />
                <input className={inputClass} name="claim" placeholder="Which statement it supports" />
                <div><SubmitButton variant="secondary">Add source</SubmitButton></div>
              </form>
            ) : null}
          </Card>

          <Card title="File that will be published">
            {previewError ? <p className="text-sm text-amber-700">Not publishable yet: {previewError}</p> : (
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{preview}</pre>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
