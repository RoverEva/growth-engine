// The knowledge base (projects/<slug>/PROJECT.json) is the source of truth for each project's
// repository, publishing target, timezone and topic terms. The database row is linked by slug.
import evaVideoStudio from "../../../projects/eva-video-studio/PROJECT.json";
import hatchelite from "../../../projects/hatchelite/PROJECT.json";

export interface ProjectManifest {
  slug: string;
  name: string;
  status: string;
  siteUrl: string;
  timezone: string;
  repo: string;
  baseBranch: string;
  publishing: { adapter: string; enabled: boolean; contentPath: string | null; branchPrefix: string; reason?: string };
  topicTerms: Record<string, number>;
  internalLinkExamples: string[];
}

type Raw = typeof hatchelite | typeof evaVideoStudio;

function toManifest(raw: Raw): ProjectManifest {
  const publishing = raw.publishing as Record<string, unknown>;
  const terms = Object.fromEntries(Object.entries(raw.topic_terms).filter(([k, v]) => !k.startsWith("$") && typeof v === "number")) as Record<string, number>;
  return {
    slug: raw.slug,
    name: raw.name,
    status: raw.status,
    siteUrl: raw.site_url,
    timezone: raw.timezone,
    repo: raw.repository.github,
    baseBranch: raw.repository.base_branch,
    publishing: {
      adapter: String(publishing.adapter),
      enabled: publishing.enabled !== false,
      contentPath: typeof publishing.content_path === "string" ? publishing.content_path : null,
      branchPrefix: String(publishing.branch_prefix),
      reason: typeof publishing.reason === "string" ? publishing.reason : undefined,
    },
    topicTerms: terms,
    internalLinkExamples: raw.internal_link_examples,
  };
}

const MANIFESTS: Record<string, ProjectManifest> = Object.fromEntries(
  [hatchelite, evaVideoStudio].map((raw) => [raw.slug, toManifest(raw)]),
);

export function getManifest(slug: string | null | undefined): ProjectManifest | null {
  return slug ? MANIFESTS[slug] ?? null : null;
}

export function listManifests(): ProjectManifest[] {
  return Object.values(MANIFESTS);
}

// Environment variable suffix for a project's own secrets: eva-video-studio → EVA_VIDEO_STUDIO.
export function envSuffix(slug: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid project slug: ${slug}`);
  return slug.toUpperCase().replace(/-/g, "_");
}

export function projectSecretName(base: string, slug: string): string {
  return `${base}__${envSuffix(slug)}`;
}

// Reads a project-scoped secret. Never falls back to another project's value or to an unscoped one.
export function projectSecret(base: string, slug: string): string | undefined {
  const value = process.env[projectSecretName(base, slug)];
  return value && value.trim() ? value.trim() : undefined;
}

// Cross-publishing safeguard: a project may publish only to the repository its manifest names.
export function assertPublishTarget(slug: string, repo: string | null | undefined): ProjectManifest {
  const manifest = getManifest(slug);
  if (!manifest) throw new Error(`No projects/${slug}/PROJECT.json manifest. Add one before publishing.`);
  if (!manifest.publishing.enabled) throw new Error(`Publishing is off for ${manifest.name}: ${manifest.publishing.reason ?? "see PROJECT.json"}.`);
  if (!repo || repo.toLowerCase() !== manifest.repo.toLowerCase()) {
    throw new Error(`${manifest.name} may only publish to ${manifest.repo}, not ${repo ?? "(none)"}.`);
  }
  if (!manifest.publishing.contentPath) throw new Error(`${manifest.name} has no content path in PROJECT.json.`);
  return manifest;
}
