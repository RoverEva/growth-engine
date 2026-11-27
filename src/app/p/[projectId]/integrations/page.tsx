import { testIntegrationAction } from "@/app/actions/integrations";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Notice } from "@/components/ui";
import { canEdit, requireProject } from "@/lib/auth";
import { listIntegrations } from "@/lib/integrations/status";

export default async function IntegrationsPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const flash = await searchParams;
  const { role, project } = await requireProject(projectId);
  const integrations = listIntegrations(project.slug);
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Integrations</h1>
      <Notice notice={flash.notice} error={flash.error} />
      <p className="text-sm text-slate-600">
        Keys live only on the server (environment variables) and are never sent to the browser. <strong>Working</strong> means the feature is built and uses this service now;
        <strong> Planned</strong> means the feature arrives in a later phase, even if a key is already set.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((i) => (
          <Card key={i.id} title={i.name} actions={<span className="flex gap-1"><Badge value={i.stage} label={i.stage === "working" ? `Phase ${i.phase} · working` : `Phase ${i.phase} · planned`} /><Badge value={i.configured ? "succeeded" : "missing"} label={i.configured ? "key set" : "not connected"} /></span>}>
            <p className="text-sm text-slate-600">{i.purpose}</p>
            <p className="mt-2 text-xs text-slate-500">Environment: {i.envVars.map((v) => <code key={v} className="mr-1 rounded bg-slate-100 px-1">{v}</code>)}</p>
            {i.testable && i.configured && canEdit(role) ? (
              <form action={testIntegrationAction.bind(null, projectId, i.id)} className="mt-3"><SubmitButton variant="secondary" pending="Testing…">Test connection</SubmitButton></form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
