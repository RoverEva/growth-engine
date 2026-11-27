import "server-only";
import { env } from "@/lib/env";
import { fetchJson } from "@/lib/retry";
import { testDataForSeo } from "./dataforseo";
import { testGitHub } from "./github";
import { projectSecret, projectSecretName } from "@/lib/projects/registry";
import { buffer } from "@/lib/social/buffer";
import { isProviderConfigured, providerKey } from "@/lib/social";

export type IntegrationId = "supabase" | "dataforseo" | "github" | "buffer" | "openai" | "gsc" | "trigger";

export interface IntegrationInfo {
  id: IntegrationId;
  name: string;
  purpose: string;
  envVars: string[];
  configured: boolean;
  // "working": built and used in Phase 1. "planned": credentials can be checked,
  // but the feature using it is not built yet.
  stage: "working" | "planned";
  phase: number;
  testable: boolean;
}

// Project-scoped credentials use the __<SLUG> suffix, so one brand's token is never used for another.
export function listIntegrations(slug: string): IntegrationInfo[] {
  return [
    { id: "supabase", name: "Supabase", purpose: "Database, sign-in and roles", envVars: ["SUPABASE_URL", "SUPABASE_ANON_KEY"], configured: !!(env.supabaseUrl() && env.supabaseAnonKey()), stage: "working", phase: 1, testable: false },
    { id: "dataforseo", name: "DataForSEO", purpose: "Keyword ideas, search volume, difficulty, intent", envVars: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"], configured: !!(env.dataforseoLogin() && env.dataforseoPassword()), stage: "working", phase: 1, testable: true },
    { id: "github", name: "GitHub", purpose: "Publishing approved articles as pull requests to this project's own repo", envVars: [projectSecretName("GITHUB_TOKEN", slug)], configured: !!projectSecret("GITHUB_TOKEN", slug), stage: "working", phase: 1, testable: true },
    { id: "buffer", name: "Buffer", purpose: "Social posts to this project's linked channels, after approval", envVars: [projectSecretName("BUFFER_API_KEY", slug), "or BUFFER_API_KEY"], configured: isProviderConfigured("buffer", slug), stage: "working", phase: 2, testable: true },
    { id: "openai", name: "OpenAI", purpose: "Research, outlines, drafts and AI quality checks", envVars: ["OPENAI_API_KEY"], configured: !!env.openaiKey(), stage: "planned", phase: 2, testable: true },
    { id: "gsc", name: "Google Search Console", purpose: "Clicks, impressions, CTR, position", envVars: ["GSC_SERVICE_ACCOUNT_JSON"], configured: !!env.gscCredentials(), stage: "planned", phase: 3, testable: false },
    { id: "trigger", name: "Trigger.dev", purpose: "Scheduled and long-running background jobs", envVars: ["TRIGGER_SECRET_KEY"], configured: !!env.triggerKey(), stage: "planned", phase: 3, testable: false },
  ];
}

export async function testIntegration(id: IntegrationId, context: { slug: string; githubRepo?: string | null }): Promise<string> {
  switch (id) {
    case "dataforseo":
      return testDataForSeo();
    case "github":
      if (!context.githubRepo) throw new Error("Set the GitHub repository in project settings first.");
      return testGitHub(context.slug, context.githubRepo);
    case "buffer": {
      const channels = await buffer.listChannels(providerKey("buffer", context.slug));
      return `Key works: ${channels.length} channel(s) visible in Buffer. Link this brand's channels on the Social page.`;
    }
    case "openai": {
      const data = await fetchJson<{ data: unknown[] }>("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${env.openaiKey() ?? ""}` }, timeoutMs: 15000 });
      return `Key works (${data.data.length} models visible). Article generation arrives in Phase 2.`;
    }
    default:
      throw new Error("No connection test for this integration yet.");
  }
}
