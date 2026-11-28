import "server-only";
import { listPullRequestFiles, readRepoFile, type BlogPullRequest } from "@/lib/integrations/github";

// Reads a blog pull request opened by the daily blog task: the post's Markdown and marketing/social/<slug>.json.
// Nothing here writes anywhere: the caller saves the result in the engine for approval.

export interface ImportedPost {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  date: string | null;
  body: string;
  sources: Array<{ url: string; title: string }>;
}

export interface ImportedSocial {
  network: string;
  title?: string | null;
  text: string;
  link: string | null;
  image: boolean;
}

export interface ImportedPullRequest {
  pr: BlogPullRequest;
  post: ImportedPost;
  url: string;
  imageUrl: string | null;
  social: ImportedSocial[];
  warnings: string[];
}

export function parseFrontMatter(markdown: string) {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error("The post has no front matter.");
  const meta: Record<string, string | string[]> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const raw = line.slice(i + 1).trim();
    meta[key] = /^\[.*\]$/.test(raw) ? raw.slice(1, -1).split(",").map((t) => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean) : raw.replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2].trim() };
}

export function sourcesFrom(body: string) {
  const section = body.split(/^##\s+Sources\s*$/im)[1] ?? "";
  return [...section.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({ title: m[1], url: m[2] }));
}

export async function readBlogPullRequest(projectSlug: string, repo: string, contentPath: string, siteUrl: string, pr: BlogPullRequest): Promise<ImportedPullRequest> {
  const files = await listPullRequestFiles(projectSlug, repo, pr.number);
  const dir = contentPath.replace(/\/+$/, "") + "/";
  const posts = files.filter((f) => f.filename.startsWith(dir) && f.filename.endsWith(".md") && f.status !== "removed");
  if (posts.length !== 1) throw new Error(`PR #${pr.number} should add exactly one post in ${dir} (found ${posts.length}).`);
  const slug = posts[0].filename.slice(dir.length, -3);
  const { meta, body } = parseFrontMatter(await readRepoFile(projectSlug, repo, posts[0].filename, pr.headSha));
  const warnings: string[] = [];
  const post: ImportedPost = {
    slug, body,
    title: String(meta.title ?? slug), description: String(meta.description ?? ""),
    tags: Array.isArray(meta.tags) ? meta.tags : [], date: typeof meta.date === "string" ? meta.date : null,
    sources: sourcesFrom(body),
  };
  const url = `${siteUrl.replace(/\/+$/, "")}/blog/${slug}`;
  let social: ImportedSocial[] = [];
  let imageUrl: string | null = null;
  const socialFile = files.find((f) => f.filename === `marketing/social/${slug}.json`);
  if (socialFile) {
    try {
      const data = JSON.parse(await readRepoFile(projectSlug, repo, socialFile.filename, pr.headSha));
      imageUrl = typeof data.image_url === "string" && data.image_url.startsWith("https://") ? data.image_url : null;
      social = (Array.isArray(data.posts) ? data.posts : []).filter((p: ImportedSocial) => p && typeof p.text === "string" && p.network)
        .map((p: ImportedSocial) => ({ network: String(p.network).toLowerCase(), title: p.title ?? null, text: p.text.slice(0, 3000), link: p.link ?? null, image: p.image !== false }));
    } catch {
      warnings.push(`marketing/social/${slug}.json is not valid JSON; no social posts imported.`);
    }
  } else warnings.push("No marketing/social file in this PR: social posts can be written on the Social page.");
  return { pr, post, url, imageUrl, social, warnings };
}
