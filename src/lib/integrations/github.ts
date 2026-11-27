import "server-only";
import { env, requireEnv } from "@/lib/env";
import { fetchJson, HttpError } from "@/lib/retry";

// Publishing = a pull request that adds one Markdown post to the website repo.
// The website's existing blog build turns it into /blog/<slug>, adds metadata,
// structured data and a sitemap entry. Nothing goes live until the PR is merged
// and the site is deployed (the human approval gate).
const API = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${requireEnv(env.githubToken(), "GITHUB_TOKEN")}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

const gh = <T>(path: string, init: RequestInit = {}) => fetchJson<T>(`${API}${path}`, { ...init, headers: headers(), timeoutMs: 30000 });

export async function testGitHub(repo: string): Promise<string> {
  const data = await gh<{ full_name: string; permissions?: { push?: boolean } }>(`/repos/${repo}`);
  if (!data.permissions?.push) throw new Error(`Token can read ${data.full_name} but cannot push to it.`);
  return `Can open pull requests on ${data.full_name}`;
}

async function fileExists(repo: string, path: string, ref: string) {
  try {
    await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
    return true;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return false;
    throw error;
  }
}

export interface PublishInput {
  repo: string;
  baseBranch: string;
  contentPath: string;
  slug: string;
  markdown: string;
  title: string;
  prBody: string;
}

export async function openArticlePullRequest(input: PublishInput) {
  const path = `${input.contentPath.replace(/\/+$/, "")}/${input.slug}.md`;
  if (await fileExists(input.repo, path, input.baseBranch)) {
    throw new Error(`${path} already exists on ${input.baseBranch}. Choose a different slug.`);
  }
  const base = await gh<{ object: { sha: string } }>(`/repos/${input.repo}/git/ref/heads/${encodeURIComponent(input.baseBranch)}`);
  const branch = `seo-engine/${input.slug}`;
  try {
    await gh(`/repos/${input.repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
  } catch (error) {
    // 422 = branch already exists from an earlier attempt: reuse it.
    if (!(error instanceof HttpError && error.status === 422)) throw error;
  }
  const existing = (await fileExists(input.repo, path, branch))
    ? await gh<{ sha: string }>(`/repos/${input.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`)
    : null;
  await gh(`/repos/${input.repo}/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Blog: ${input.title}`,
      content: Buffer.from(input.markdown, "utf8").toString("base64"),
      branch,
      ...(existing ? { sha: existing.sha } : {}),
    }),
  });
  const open = await gh<Array<{ number: number; html_url: string }>>(
    `/repos/${input.repo}/pulls?state=open&head=${encodeURIComponent(`${input.repo.split("/")[0]}:${branch}`)}`);
  if (open[0]) return { number: open[0].number, url: open[0].html_url, branch, path };
  const pr = await gh<{ number: number; html_url: string }>(`/repos/${input.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title: `Blog: ${input.title}`, head: branch, base: input.baseBranch, body: input.prBody }),
  });
  return { number: pr.number, url: pr.html_url, branch, path };
}

export async function getPullRequestState(repo: string, number: number) {
  const pr = await gh<{ state: string; merged: boolean; merged_at: string | null; html_url: string }>(`/repos/${repo}/pulls/${number}`);
  return { merged: pr.merged, state: pr.state, mergedAt: pr.merged_at, url: pr.html_url };
}
