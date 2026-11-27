import { addMember, removeMember, updateBrand, updateProject } from "@/app/actions/projects";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Notice, inputClass, labelClass } from "@/components/ui";
import { requireProject } from "@/lib/auth";

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const flash = await searchParams;
  const { supabase, project, role, user } = await requireProject(projectId);
  const isOwner = role === "owner";
  const [{ data: brand }, { data: members }] = await Promise.all([
    supabase.from("brand_profiles").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.rpc("project_member_list", { p_project: projectId }),
  ]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Notice notice={flash.notice} error={flash.error} />
      {!isOwner ? <p className="text-sm text-slate-600">Only owners can change settings.</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Project and publishing">
          <form action={updateProject.bind(null, projectId)}>
            <fieldset disabled={!isOwner} className="grid gap-3">
              <label className={labelClass}>Name<input className={inputClass} name="name" defaultValue={project.name} required /></label>
              <label className={labelClass}>Website<input className={inputClass} name="site_url" defaultValue={project.site_url} required /></label>
              <label className={labelClass}>GitHub repository<input className={inputClass} name="github_repo" defaultValue={project.github_repo ?? ""} placeholder="owner/repo" /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Base branch<input className={inputClass} name="github_base_branch" defaultValue={project.github_base_branch} /></label>
                <label className={labelClass}>Blog folder<input className={inputClass} name="blog_content_path" defaultValue={project.blog_content_path} /></label>
                <label className={labelClass}>Location code<input className={inputClass} name="default_location_code" type="number" defaultValue={project.default_location_code} /></label>
                <label className={labelClass}>Language code<input className={inputClass} name="default_language_code" defaultValue={project.default_language_code} /></label>
              </div>
              {isOwner ? <div><SubmitButton>Save</SubmitButton></div> : null}
            </fieldset>
          </form>
        </Card>
        <Card title="Brand profile">
          <form action={updateBrand.bind(null, projectId)}>
            <fieldset disabled={!isOwner} className="grid gap-3">
              <label className={labelClass}>Brand name<input className={inputClass} name="brand_name" defaultValue={brand?.brand_name} /></label>
              <label className={labelClass}>Audience<textarea className={inputClass} name="audience" rows={2} defaultValue={brand?.audience} /></label>
              <label className={labelClass}>Voice<textarea className={inputClass} name="voice" rows={2} defaultValue={brand?.voice} /></label>
              <label className={labelClass}>Products and offers<textarea className={inputClass} name="products" rows={3} defaultValue={brand?.products} /></label>
              <label className={labelClass}>Topics to avoid<textarea className={inputClass} name="topics_to_avoid" rows={2} defaultValue={brand?.topics_to_avoid} /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Author name<input className={inputClass} name="author_name" defaultValue={brand?.author_name} /></label>
                <label className={labelClass}>Minimum quality score<input className={inputClass} name="min_quality_score" type="number" min={0} max={100} defaultValue={brand?.min_quality_score} /></label>
              </div>
              <p className="text-xs text-slate-500">Every article needs an owner&apos;s approval before publishing. Quality-gated automatic publishing is off in Phase 1.</p>
              {isOwner ? <div><SubmitButton>Save</SubmitButton></div> : null}
            </fieldset>
          </form>
        </Card>
      </div>
      <Card title="Members">
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {(members ?? []).map((m: { user_id: string; email: string; role: string }) => (
            <li key={m.user_id} className="flex items-center justify-between py-2">
              <span>{m.email}</span>
              <span className="flex items-center gap-3"><Badge value={m.role} />
                {isOwner && m.user_id !== user.id ? <form action={removeMember.bind(null, projectId, m.user_id)}><button className="text-xs text-red-700 hover:underline">Remove</button></form> : null}
              </span>
            </li>
          ))}
        </ul>
        {isOwner ? (
          <form action={addMember.bind(null, projectId)} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className={labelClass}>Email (they must have signed up)<input className={inputClass} name="email" type="email" required /></label>
            <label className={labelClass}>Role
              <select className={inputClass} name="role" defaultValue="editor"><option value="editor">Editor: research, write, submit</option><option value="viewer">Viewer: read only</option><option value="owner">Owner: approve, publish, settings</option></select>
            </label>
            <SubmitButton>Add member</SubmitButton>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
