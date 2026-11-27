import { Badge, Card, Empty, Notice, Stat, TextLink } from "@/components/ui";
import { requireProject } from "@/lib/auth";
import { isoDateDaysAgo } from "@/lib/dates";

export default async function Dashboard({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const flash = await searchParams;
  const { supabase } = await requireProject(projectId);

  const [keywordCount, opportunities, articles, perf, runs] = await Promise.all([
    supabase.from("keywords").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("keywords").select("id, keyword, search_volume, keyword_difficulty, opportunity_score, status")
      .eq("project_id", projectId).not("status", "in", "(ignored,in_use)").order("opportunity_score", { ascending: false, nullsFirst: false }).limit(8),
    supabase.from("articles").select("id, title, status, quality_score, published_at").eq("project_id", projectId).order("updated_at", { ascending: false }),
    supabase.from("search_performance").select("clicks, impressions, position").eq("project_id", projectId)
      .gte("date", isoDateDaysAgo(28)),
    supabase.from("automation_runs").select("id, kind, status, error, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(5),
  ]);

  const rows = perf.data ?? [];
  const clicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const positioned = rows.filter((r) => r.position != null);
  const avgPosition = positioned.length ? positioned.reduce((s, r) => s + Number(r.position), 0) / positioned.length : null;
  const byStatus = (articles.data ?? []).reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {});
  const noGsc = rows.length === 0;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <Notice notice={flash.notice} error={flash.error} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Organic clicks (28 days)" value={noGsc ? "—" : clicks.toLocaleString()} hint={noGsc ? "Search Console: Phase 3, not connected" : undefined} />
        <Stat label="Impressions (28 days)" value={noGsc ? "—" : impressions.toLocaleString()} hint={noGsc ? "Search Console: Phase 3, not connected" : undefined} />
        <Stat label="Average CTR" value={noGsc || !impressions ? "—" : `${((clicks / impressions) * 100).toFixed(1)}%`} />
        <Stat label="Average position" value={avgPosition == null ? "—" : avgPosition.toFixed(1)} />
        <Stat label="Saved keywords" value={(keywordCount.count ?? 0).toLocaleString()} />
        <Stat label="Articles in progress" value={(byStatus.draft ?? 0) + (byStatus.in_review ?? 0) + (byStatus.approved ?? 0)} />
        <Stat label="Waiting for merge" value={byStatus.pr_open ?? 0} />
        <Stat label="Published articles" value={byStatus.published ?? 0} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top keyword opportunities" actions={<TextLink href={`/p/${projectId}/keywords`}>All keywords</TextLink>}>
          {opportunities.data?.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500"><th className="py-1">Keyword</th><th>Volume</th><th>KD</th><th>Score</th></tr></thead>
              <tbody>
                {opportunities.data.map((k) => (
                  <tr key={k.id} className="border-t border-slate-100">
                    <td className="py-1.5">{k.keyword}</td><td>{k.search_volume ?? "—"}</td><td>{k.keyword_difficulty ?? "—"}</td><td className="font-semibold">{k.opportunity_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No keywords yet. Run keyword research.</Empty>}
        </Card>
        <Card title="Articles" actions={<TextLink href={`/p/${projectId}/articles`}>All articles</TextLink>}>
          {articles.data?.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {articles.data.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <TextLink href={`/p/${projectId}/articles/${a.id}`}>{a.title}</TextLink>
                  <span className="flex items-center gap-2">{a.quality_score != null ? <span className="text-slate-500">{a.quality_score}/100</span> : null}<Badge value={a.status} /></span>
                </li>
              ))}
            </ul>
          ) : <Empty>No articles yet.</Empty>}
        </Card>
      </div>
      <Card title="Recent runs" actions={<TextLink href={`/p/${projectId}/runs`}>Run log</TextLink>}>
        {runs.data?.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {runs.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span>{r.kind.replace(/_/g, " ")} <span className="text-slate-400">· {new Date(r.created_at).toLocaleString("en-US")}</span></span>
                <Badge value={r.status} />
              </li>
            ))}
          </ul>
        ) : <Empty>No runs yet.</Empty>}
      </Card>
    </div>
  );
}
