import { createArticle } from "@/app/actions/articles";
import { addKeyword, researchKeywords, setKeywordStatus } from "@/app/actions/keywords";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Notice, inputClass, labelClass } from "@/components/ui";
import { canEdit, requireProject } from "@/lib/auth";
import { env } from "@/lib/env";

const STATUSES = ["new", "shortlisted", "planned", "in_use", "ignored"] as const;

export default async function KeywordsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const query = await searchParams;
  const { supabase, role } = await requireProject(projectId);
  const editable = canEdit(role);
  const status = STATUSES.includes(query.status as (typeof STATUSES)[number]) ? query.status! : "active";
  const minRelevance = Number(query.relevant ?? "1");

  let request = supabase.from("keywords")
    .select("id, keyword, search_volume, keyword_difficulty, cpc, intent, business_relevance, opportunity_score, status, source")
    .eq("project_id", projectId).order("opportunity_score", { ascending: false, nullsFirst: false }).order("search_volume", { ascending: false, nullsFirst: false }).limit(300);
  request = status === "active" ? request.neq("status", "ignored") : request.eq("status", status);
  if (minRelevance > 0) request = request.gte("business_relevance", minRelevance);
  const { data: keywords } = await request;
  const dataforseoReady = Boolean(env.dataforseoLogin() && env.dataforseoPassword());

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Keyword research</h1>
      <Notice notice={query.notice} error={query.error} />
      {editable ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Find keyword ideas (DataForSEO)">
            {!dataforseoReady ? <p className="mb-3 text-sm text-amber-700">DataForSEO is not connected. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.</p> : null}
            <form action={researchKeywords.bind(null, projectId)} className="grid gap-3">
              <label className={labelClass}>Seed keywords (one per line)
                <textarea className={inputClass} name="seeds" rows={4} required placeholder={"isee vocabulary\nssat analogies\n3rd grade vocabulary words"} />
              </label>
              <label className={labelClass}>Max ideas<input className={inputClass} name="limit" type="number" min={10} max={500} defaultValue={100} /></label>
              <SubmitButton pending="Researching…">Research</SubmitButton>
              <p className="text-xs text-slate-500">Each run is a paid DataForSEO call. Results are saved without duplicates and logged in the run log.</p>
            </form>
          </Card>
          <Card title="Add a keyword by hand">
            <form action={addKeyword.bind(null, projectId)} className="grid gap-3">
              <label className={labelClass}>Keyword<input className={inputClass} name="keyword" required /></label>
              <SubmitButton>Add</SubmitButton>
            </form>
          </Card>
          <Card title="How the score works">
            <p className="text-sm text-slate-600">
              Opportunity (0–100) = business relevance to HatchElite (45%) + search demand (30%) + ease from difficulty (25%),
              weighted by intent. Off-topic keywords score 0 and are hidden by default.
            </p>
          </Card>
        </div>
      ) : null}
      <Card title={`Keywords (${keywords?.length ?? 0})`} actions={
        <form className="flex items-center gap-2 text-sm">
          <select name="status" defaultValue={status} className="rounded-lg border border-slate-300 px-2 py-1">
            <option value="active">All except ignored</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <select name="relevant" defaultValue={String(minRelevance)} className="rounded-lg border border-slate-300 px-2 py-1">
            <option value="1">Relevant only</option><option value="0">Include off-topic</option>
          </select>
          <button className="rounded-lg border border-slate-300 px-2 py-1 font-medium" type="submit">Filter</button>
        </form>
      }>
        {keywords?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Keyword</th><th>Volume</th><th>KD</th><th>CPC</th><th>Intent</th><th>Relevance</th><th>Score</th><th>Status</th>{editable ? <th /> : null}</tr></thead>
              <tbody>
                {keywords.map((k) => (
                  <tr key={k.id} className="border-t border-slate-100 align-middle">
                    <td className="py-1.5 font-medium">{k.keyword}</td>
                    <td>{k.search_volume?.toLocaleString() ?? "—"}</td><td>{k.keyword_difficulty ?? "—"}</td>
                    <td>{k.cpc != null ? `$${Number(k.cpc).toFixed(2)}` : "—"}</td><td>{k.intent}</td>
                    <td>{k.business_relevance ?? "—"}</td><td className="font-semibold">{k.opportunity_score ?? "—"}</td>
                    <td><Badge value={k.status} /></td>
                    {editable ? (
                      <td className="flex flex-wrap justify-end gap-1 py-1">
                        {k.status !== "shortlisted" ? <form action={setKeywordStatus.bind(null, projectId, k.id, "shortlisted")}><button className="text-xs font-semibold text-violet-700 hover:underline">Shortlist</button></form> : null}
                        {k.status !== "ignored" ? <form action={setKeywordStatus.bind(null, projectId, k.id, "ignored")}><button className="text-xs text-slate-500 hover:underline">Ignore</button></form> : null}
                        {k.status !== "in_use" ? (
                          <form action={createArticle.bind(null, projectId)}>
                            <input type="hidden" name="keyword_id" value={k.id} />
                            <button className="text-xs font-semibold text-emerald-700 hover:underline">Start article</button>
                          </form>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No keywords match.</Empty>}
      </Card>
    </div>
  );
}
