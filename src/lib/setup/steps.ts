import "server-only";
import { listManifests, projectSecret, projectSecretName, type ProjectManifest } from "@/lib/projects/registry";
import { isProviderConfigured } from "@/lib/social";

// The account setup wizard: exactly which accounts the owner must create or authorize, per brand, and what is
// already done. Only names of environment variables are shown, never their values.
export const SETUP_GUIDE_URL = "https://claude.ai/artifact/LoX62F7TzBvpEbYQqA7ji3";

export type StepState = "done" | "todo" | "unchecked" | "blocked";
export interface SetupStep {
  id: string;
  title: string;
  who: "You" | "Claude" | "You, then Claude";
  why: string;
  how: string;
  state: StepState;
  detail?: string;
  cost: string;
}

const has = (name: string) => !!process.env[name]?.trim();

export function accountSteps(): SetupStep[] {
  return [
    { id: "supabase", title: "Supabase project for the Growth Engine", who: "You", cost: "$0 (free plan)",
      why: "Stores keywords, drafts, the approval queue and run history for both brands, separated by project.",
      how: "Create a project named growth-engine, then add SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_DB_URL as GitHub secrets. The migrate workflow installs the tables.",
      state: has("SUPABASE_URL") && has("SUPABASE_ANON_KEY") ? "done" : "todo" },
    { id: "gsc-service-account", title: "Google service account (read-only Search Console)", who: "You", cost: "$0",
      why: "Lets the engine read clicks, impressions and positions for each site.",
      how: "Create service account gsc-reader in Google Cloud, enable the Search Console API, download its JSON key and save it as the GSC_SERVICE_ACCOUNT_JSON secret. Then add its email as a Restricted user in each site's Search Console property.",
      state: has("GSC_SERVICE_ACCOUNT_JSON") ? "done" : "todo" },
    { id: "buffer", title: "Buffer account with each brand's social accounts", who: "You", cost: "$0 (free plan; 1 API key)",
      why: "Approved social posts go to Buffer, which publishes them on schedule.",
      how: "Connect each brand's social accounts in Buffer, create one API key (Settings → API) and save it as the BUFFER_API_KEY secret. Then link each channel to its brand on that project's Social page.",
      state: has("BUFFER_API_KEY") || listManifests().some((m) => isProviderConfigured("buffer", m.slug)) ? "done" : "todo" },
    { id: "dataforseo", title: "DataForSEO (keyword volumes)", who: "You", cost: "$50 minimum top-up: deferred until you approve it",
      why: "Search volume and difficulty for keyword research. Search Console data covers the basics until then.",
      how: "Not needed now. Ask Claude to turn it on when you approve the cost.",
      state: has("DATAFORSEO_LOGIN") ? "done" : "blocked", detail: "Deferred by the owner." },
  ];
}

export function projectSteps(m: ProjectManifest, linked: { projectCreated: boolean; channels: number }): SetupStep[] {
  const domain = new URL(m.siteUrl).hostname;
  const ghName = projectSecretName("GITHUB_TOKEN", m.slug);
  const stripeName = projectSecretName("STRIPE_RESTRICTED_KEY", m.slug);
  const posthogName = projectSecretName("POSTHOG_PERSONAL_API_KEY", m.slug);
  return [
    { id: "gsc-verify", title: `Verify ${domain} in Search Console`, who: "You", cost: "$0",
      why: "Without it Google won't share search data, and you can't submit the sitemap.",
      how: `Add a Domain property for ${domain}, copy the TXT record into your DNS, click Verify, then submit ${m.siteUrl}/sitemap.xml.`,
      state: "unchecked", detail: "Checked automatically once the service account can read the property (next roadmap step)." },
    { id: "posthog", title: `PostHog organization for ${m.name}`, who: "You, then Claude", cost: "$0 (free plan)",
      why: "Shows which pages lead to sign-ups and payments, with privacy settings already locked down in the site code.",
      how: `Create a separate PostHog organization "${m.name}" (one project). Turn off autocapture, session replay and heatmaps; turn on Discard client IP${m.slug === "eva-video-studio" ? " and cookieless server-side mode" : ""}. Paste the public phc_ project key in chat; save a personal API key as ${posthogName}.`,
      state: projectSecret("POSTHOG_PERSONAL_API_KEY", m.slug) ? "done" : "todo" },
    { id: "stripe", title: `Restricted read-only Stripe key for ${m.name}`, who: "You", cost: "$0",
      why: "Counts trials, payments and failed payments per brand. Read-only: it can't charge, refund or change anything.",
      how: `In this brand's Stripe account: Developers → API keys → Create restricted key, Read on Charges, Checkout Sessions, Customers, Subscriptions and Invoices only. Save it as ${stripeName}.`,
      state: projectSecret("STRIPE_RESTRICTED_KEY", m.slug) ? "done" : "todo" },
    { id: "github", title: `GitHub token for ${m.repo} only`, who: "You", cost: "$0",
      why: "Lets the engine open pull requests with approved content. Merging stays your decision.",
      how: `Fine-grained token, repository access: only ${m.repo}; permissions Contents and Pull requests: Read and write. Save it as ${ghName}.`,
      state: projectSecret("GITHUB_TOKEN", m.slug) ? "done" : "todo",
      detail: m.publishing.enabled ? undefined : `Publishing is off for this project: ${m.publishing.reason ?? ""}` },
    { id: "engine-project", title: `Add ${m.name} to the engine`, who: "Claude", cost: "$0",
      why: "Creates the project's private space (keywords, drafts, channels, queue).",
      how: "Home page → New project → choose it from the knowledge base.",
      state: linked.projectCreated ? "done" : "todo" },
    { id: "channels", title: `Link ${m.name}'s social channels`, who: "You, then Claude", cost: "$0",
      why: "Posts can only go to channels linked to this brand; another brand's channel is refused.",
      how: "Project → Social → Find Buffer channels → Link the ones that belong to this brand.",
      state: linked.channels > 0 ? "done" : linked.projectCreated ? "todo" : "blocked",
      detail: linked.projectCreated ? undefined : "Needs the engine project first." },
  ];
}
