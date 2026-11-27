import { Badge, Card, Empty } from "@/components/ui";
import { requireProject } from "@/lib/auth";

type LogLine = { at: string; level: string; message: string };

export default async function RunsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase } = await requireProject(projectId);
  const { data: runs } = await supabase.from("automation_runs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100);
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Run log</h1>
      <p className="text-sm text-slate-600">Every external call and job: inputs, attempts (with automatic retries for temporary errors), cost, result and errors.</p>
      <Card>
        {runs?.length ? (
          <ul className="divide-y divide-slate-100">
            {runs.map((r) => (
              <li key={r.id} className="py-3 text-sm">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <Badge value={r.status} />
                    <span className="font-medium">{r.kind.replace(/_/g, " ")}</span>
                    <span className="text-slate-400">{new Date(r.created_at).toLocaleString("en-US")}</span>
                    <span className="text-slate-400">· {r.attempts} attempt(s){r.cost_usd != null ? ` · $${Number(r.cost_usd).toFixed(4)}` : ""}</span>
                    {r.error ? <span className="text-red-700">{String(r.error).slice(0, 140)}</span> : null}
                  </summary>
                  <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                    <div><strong>Input</strong><pre className="overflow-auto">{JSON.stringify(r.input, null, 2)}</pre></div>
                    {r.output ? <div><strong>Output</strong><pre className="overflow-auto">{JSON.stringify(r.output, null, 2)}</pre></div> : null}
                    <div><strong>Log</strong>
                      <ul>{((r.log ?? []) as LogLine[]).map((l, i) => <li key={i} className={l.level === "error" ? "text-red-700" : l.level === "warn" ? "text-amber-700" : ""}>{l.at} {l.message}</li>)}</ul>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : <Empty>No runs yet.</Empty>}
      </Card>
    </div>
  );
}
