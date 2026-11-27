import Link from "next/link";
import { QueueActions } from "@/components/queue-actions";
import { TopBar } from "@/components/top-bar";
import { Badge, Card, Empty, Notice } from "@/components/ui";
import type { Role } from "@/lib/auth";
import { requireUser } from "@/lib/auth";

// One place to review everything waiting for a decision, across every brand the user belongs to.
// Each item keeps its own project: actions run against that project only, with that project's role.
export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const flash = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: memberships } = await supabase.from("project_members").select("role, projects(id, name, slug)").eq("user_id", user.id);
  const roles = new Map<string, { role: Role; name: string }>();
  for (const m of memberships ?? []) {
    const p = m.projects as unknown as { id: string; name: string } | null;
    if (p) roles.set(p.id, { role: m.role as Role, name: p.name });
  }
  const ids = [...roles.keys()];
  const [{ data: articles }, { data: posts }] = ids.length ? await Promise.all([
    supabase.from("articles").select("id, project_id, title, status, quality_score, scheduled_for, pr_url, updated_at")
      .in("project_id", ids).in("status", ["in_review", "approved", "pr_open"]).order("updated_at", { ascending: false }),
    supabase.from("social_posts").select("id, project_id, body, status, scheduled_for, link_url, last_error, social_channels(display_name, service, provider)")
      .in("project_id", ids).in("status", ["in_review", "approved", "failed", "queued"]).order("updated_at", { ascending: false }).limit(200),
  ]) : [{ data: [] }, { data: [] }];

  const groups = ids.map((id) => ({
    id, ...roles.get(id)!,
    articles: (articles ?? []).filter((a) => a.project_id === id),
    posts: (posts ?? []).filter((p) => p.project_id === id),
  }));
  const waiting = (articles ?? []).filter((a) => a.status === "in_review").length + (posts ?? []).filter((p) => p.status === "in_review").length;

  return (
    <>
      <TopBar email={user.email} />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Approval and publishing queue</h1>
          <p className="text-sm text-slate-600">{waiting} item(s) waiting for review across {ids.length} brand(s). Nothing publishes without an owner&apos;s approval; articles go live only when you merge their pull request.</p>
        </div>
        <Notice notice={flash.notice} error={flash.error} />
        {groups.length === 0 ? <Empty>You are not a member of any project yet.</Empty> : null}
        {groups.map((g) => (
          <Card key={g.id} title={g.name} actions={<span className="flex items-center gap-2"><Badge value={g.role} /><Link className="text-sm text-violet-700 underline" href={`/p/${g.id}`}>Open project</Link></span>}>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Blog articles</h3>
            {g.articles.length ? (
              <ul className="mb-4 divide-y divide-slate-100 text-sm">
                {g.articles.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><Badge value={a.status} /> <Link className="font-medium text-violet-700 underline" href={`/p/${g.id}/articles/${a.id}`}>{a.title}</Link> <span className="text-slate-500">score {a.quality_score ?? "–"}</span></span>
                    <span className="text-slate-500">
                      {a.status === "in_review" ? "Review and approve on the article page" : a.status === "approved" ? "Approved: publish opens a pull request" : <a className="underline" href={a.pr_url ?? "#"}>Pull request open: merge to publish</a>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mb-4 text-sm text-slate-500">No articles waiting.</p>}
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Social posts</h3>
            {g.posts.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {g.posts.map((p) => {
                  const ch = p.social_channels as unknown as { display_name: string; service: string; provider: string } | null;
                  return (
                    <li key={p.id} className="grid gap-2 py-3">
                      <span className="flex flex-wrap items-center gap-2"><Badge value={p.status} /><span className="text-slate-500">{ch?.display_name ?? "channel"} ({ch?.service}) · {p.scheduled_for ? new Date(p.scheduled_for).toLocaleString("en-US") : "next queue slot"}</span></span>
                      <p className="whitespace-pre-wrap text-slate-800">{p.body}</p>
                      {p.last_error ? <p className="text-red-700">Last error: {p.last_error}</p> : null}
                      <div className="flex flex-wrap gap-2"><QueueActions kind="social" projectId={g.id} id={p.id} status={p.status} role={g.role} returnTo="/queue" /></div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-slate-500">No social posts waiting.</p>}
          </Card>
        ))}
      </main>
    </>
  );
}
