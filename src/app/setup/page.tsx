import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listManifests } from "@/lib/projects/registry";
import { accountSteps, projectSteps, SETUP_GUIDE_URL, type SetupStep } from "@/lib/setup/steps";

const STATE: Record<SetupStep["state"], { value: string; label: string }> = {
  done: { value: "published", label: "done" }, todo: { value: "in_review", label: "to do" },
  unchecked: { value: "planned", label: "check manually" }, blocked: { value: "draft", label: "waiting" },
};

function Steps({ steps }: { steps: SetupStep[] }) {
  return (
    <ol className="grid gap-3">
      {steps.map((s, i) => (
        <li key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">{i + 1}. {s.title}</span>
            <span className="flex items-center gap-2"><span className="text-xs text-slate-500">{s.who} · {s.cost}</span><Badge value={STATE[s.state].value} label={STATE[s.state].label} /></span>
          </div>
          <p className="mt-1 text-slate-600">{s.why}</p>
          {s.state !== "done" ? <p className="mt-1 text-slate-800">{s.how}</p> : null}
          {s.detail ? <p className="mt-1 text-xs text-slate-500">{s.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export default async function SetupPage() {
  const { supabase, user } = await requireUser();
  const { data: projects } = await supabase.from("projects").select("id, slug");
  const bySlug = new Map((projects ?? []).map((p) => [p.slug as string, p.id as string]));
  const { data: channels } = await supabase.from("social_channels").select("project_id");
  const channelCount = (id?: string) => (channels ?? []).filter((c) => c.project_id === id).length;

  const shared = accountSteps();
  const brands = listManifests().map((m) => {
    const id = bySlug.get(m.slug);
    return { m, id, steps: projectSteps(m, { projectCreated: !!id, channels: channelCount(id) }) };
  });
  const all = [...shared, ...brands.flatMap((b) => b.steps)];
  const done = all.filter((s) => s.state === "done").length;

  return (
    <>
      <TopBar email={user.email} />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Account setup</h1>
          <p className="text-sm text-slate-600">
            {done} of {all.length} steps done. These are the only things that need you (account ownership, DNS, approval of costs).
            Everything else is configured by Claude. Step-by-step screenshots-level instructions: <a className="text-violet-700 underline" href={SETUP_GUIDE_URL}>Account Setup Guide</a>.
            Never paste secret keys into chat: save them as GitHub secrets in RoverEva/growth-engine.
          </p>
        </div>
        <Card title="Shared accounts (one for the whole engine)"><Steps steps={shared} /></Card>
        <div className="grid gap-6 lg:grid-cols-2">
          {brands.map((b) => (
            <Card key={b.m.slug} title={b.m.name} actions={b.id ? <Link className="text-sm text-violet-700 underline" href={`/p/${b.id}`}>Open project</Link> : <Badge value={b.m.status} />}>
              <p className="mb-3 text-xs text-slate-500">Credentials for this brand use the suffix <code>__{b.m.slug.toUpperCase().replace(/-/g, "_")}</code> and are never used for another brand.</p>
              <Steps steps={b.steps} />
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
