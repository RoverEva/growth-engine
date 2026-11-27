import { createArticle } from "@/app/actions/articles";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Notice, TextLink, inputClass, labelClass } from "@/components/ui";
import { canEdit, requireProject } from "@/lib/auth";

export default async function ArticlesPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const flash = await searchParams;
  const { supabase, role } = await requireProject(projectId);
  const { data: articles } = await supabase.from("articles")
    .select("id, title, target_keyword, slug, status, quality_score, scheduled_for, pr_url, updated_at")
    .eq("project_id", projectId).order("updated_at", { ascending: false });

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Articles</h1>
      <Notice notice={flash.notice} error={flash.error} />
      <p className="text-sm text-slate-600">
        Workflow: <Badge value="draft" /> → quality check → <Badge value="in_review" /> → owner approves → <Badge value="approved" /> → publish opens a pull request
        → <Badge value="pr_open" /> → merge + deploy → <Badge value="published" />
      </p>
      {canEdit(role) ? (
        <Card title="New article">
          <form action={createArticle.bind(null, projectId)} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className={labelClass}>Target keyword<input className={inputClass} name="target_keyword" required placeholder="isee lower level vocabulary" /></label>
            <label className={labelClass}>Working title (optional)<input className={inputClass} name="title" /></label>
            <SubmitButton>Create draft</SubmitButton>
          </form>
          <p className="mt-2 text-xs text-slate-500">One article per target keyword: duplicates are blocked by the database.</p>
        </Card>
      ) : null}
      <Card>
        {articles?.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-1">Title</th><th>Keyword</th><th>Score</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-2"><TextLink href={`/p/${projectId}/articles/${a.id}`}>{a.title}</TextLink><div className="text-xs text-slate-400">/blog/{a.slug}</div></td>
                  <td>{a.target_keyword}</td><td>{a.quality_score ?? "—"}</td><td><Badge value={a.status} /></td>
                  <td className="text-slate-500">{new Date(a.updated_at).toLocaleDateString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>No articles yet. Start one here or from a keyword.</Empty>}
      </Card>
    </div>
  );
}
