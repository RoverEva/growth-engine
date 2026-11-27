import Link from "next/link";
import { createProject } from "@/app/actions/projects";
import { SubmitButton } from "@/components/submit-button";
import { TopBar } from "@/components/top-bar";
import { Badge, Card, Empty, Notice, inputClass, labelClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listManifests } from "@/lib/projects/registry";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const { data: memberships } = await supabase
    .from("project_members").select("role, projects(id, name, site_url)").eq("user_id", user.id);

  return (
    <>
      <TopBar email={user.email} />
      <main className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Notice notice={params.notice} error={params.error} />
        <Card>
          {memberships?.length ? (
            <ul className="divide-y divide-slate-100">
              {memberships.map((m) => {
                const p = m.projects as unknown as { id: string; name: string; site_url: string };
                return (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link className="font-semibold text-violet-700 hover:underline" href={`/p/${p.id}`}>{p.name}</Link>
                      <p className="text-sm text-slate-500">{p.site_url}</p>
                    </div>
                    <Badge value={m.role} />
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No projects yet. Create one below, or ask an owner to add you.</Empty>}
        </Card>
        <Card title="New project">
          <form action={createProject} className="grid gap-3 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>Project from the knowledge base
              <select className={inputClass} name="slug" required>
                {listManifests().map((m) => <option key={m.slug} value={m.slug}>{m.name} ({m.siteUrl}) · {m.status}</option>)}
              </select>
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">Name, website and repository come from <code>projects/&lt;slug&gt;/PROJECT.json</code>.</p>
            <div><SubmitButton pending="Creating…">Create project</SubmitButton></div>
          </form>
        </Card>
      </main>
    </>
  );
}
