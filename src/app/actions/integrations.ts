"use server";
import { requireProject } from "@/lib/auth";
import { back, errorText } from "@/lib/flash";
import { listIntegrations, testIntegration, type IntegrationId } from "@/lib/integrations/status";

export async function testIntegrationAction(projectId: string, id: IntegrationId) {
  const path = `/p/${projectId}/integrations`;
  let notice = "";
  try {
    const { project } = await requireProject(projectId, "editor");
    const info = listIntegrations().find((i) => i.id === id);
    if (!info?.configured) throw new Error(`${info?.name ?? id} is not configured. Set ${info?.envVars.join(", ")} first.`);
    notice = `${info.name}: ${await testIntegration(id, { githubRepo: project.github_repo })}`;
  } catch (error) {
    back(path, { error: `Connection test failed: ${errorText(error)}` });
  }
  back(path, { notice });
}
