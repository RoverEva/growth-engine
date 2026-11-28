import "server-only";
import { MissingConfigError } from "@/lib/env";
import { projectSecret, projectSecretName } from "@/lib/projects/registry";
import { fetchJson, HttpError } from "@/lib/retry";

// Publishing = a pull request that adds one Markdown post to the website repo.
// The website's existing blog build turns it into /blog/<slug>, adds metadata,
// structured data and a sitemap entry. Nothing goes live until the PR is merged
// and the site is deployed (the human approval gate).
const API = "https://api.github.com";

// Each project has its own fine-grained token (GITHUB_TOKEN__<SLUG>) limited to its own website repo.
function headers(slug: string) {
  const token = projectSecret("GITHUB_TOKEN", slug);
  if (!token) throw new MissingConfigError(projectSecretName("GITHUB_TOKEN", slug));
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

const client = (slug: string) => <T>(path: string, init: RequestInit = {}) =>
  fetchJson<T>(`${API}${path}`, { ...init, headers: headers(slug), timeoutMs: 30000 });

export async function testGitHub(slug: string, repo: string): Promise<string> {
  const gh = client(slug);
  const data = await gh<{ full_name: string; permissions?: { push?: boolean } }>(`/repos/${repo}`);
  if (!data.permissions?.push) throw new Error(`Token can read ${data.full_name} but cannot push to it.`);
  return `Can open pull requests on ${data.full_name}`;
}

async function fileExists(gh: ReturnType<typeof client>, repo: string, path: string, ref: string) {
  try {
    await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
    return true;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return false;
    throw error;
  }
}

export interface PublishInput {
  projectSlug: string;
  branchPrefix: string;
  repo: string;
  baseBranch: string;
  contentPath: string;
  slug: string;
  markdown: string;
  title: string;
  prBody: string;
}

export async function openArticlePullRequest(input: PublishInput) {
  const gh = client(input.projectSlug);
  const path = `${input.contentPath.replace(/\/+$/, "")}/${input.slug}.md`;
  if (await fileExists(gh, input.repo, path, input.baseBranch)) {
    throw new Error(`${path} already exists on ${input.baseBranch}. Choose a different slug.`);
  }
  const base = await gh<{ object: { sha: string } }>(`/repos/${input.repo}/git/ref/heads/${encodeURIComponent(input.baseBranch)}`);
  const branch = `${input.branchPrefix}${input.slug}`;
  try {
    await gh(`/repos/${input.repo}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
  } catch (error) {
    // 422 = branch already exists from an earlier attempt: reuse it.
    if (!(error instanceof HttpError && error.status === 422)) throw error;
  }
  const existing = (await fileExists(gh, input.repo, path, branch))
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

export async function getPullRequestState(slug: string, repo: string, number: number) {
  const gh = client(slug);
  const pr = await gh<{ state: string; merged: boolean; merged_at: string | null; html_url: string; head: { sha: string } }>(`/repos/${repo}/pulls/${number}`);
  return { merged: pr.merged, state: pr.state, mergedAt: pr.merged_at, url: pr.html_url, headSha: pr.head.sha };
}

// ---- Blog pull requests written outside the engine (the daily blog task) -------------------------------------------

export interface BlogPullRequest {
  number: number;
  url: string;
  branch: string;
  headSha: string;
  title: string;
  merged: boolean;
}

// Open pull requests in the project's own repo whose branch starts with `prefix` (e.g. "blog/").
export async function listBlogPullRequests(slug: string, repo: string, prefix = "blog/"): Promise<BlogPullRequest[]> {
  const gh = client(slug);
  const prs = await gh<Array<{ number: number; html_url: string; title: string; head: { ref: string; sha: string }; merged_at: string | null }>>(
    `/repos/${repo}/pulls?state=open&per_page=50`);
  return prs.filter((p) => p.head.ref.startsWith(prefix))
    .map((p) => ({ number: p.number, url: p.html_url, branch: p.head.ref, headSha: p.head.sha, title: p.title, merged: !!p.merged_at }));
}

export async function listPullRequestFiles(slug: string, repo: string, number: number): Promise<Array<{ filename: string; status: string }>> {
  const gh = client(slug);
  return gh(`/repos/${repo}/pulls/${number}/files?per_page=100`);
}

// Text content of a file at a commit (base64 from the contents API).
export async function readRepoFile(slug: string, repo: string, path: string, ref: string): Promise<string> {
  const gh = client(slug);
  const file = await gh<{ content: string; encoding: string }>(`/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
  return Buffer.from(file.content, file.encoding === "base64" ? "base64" : "utf8").toString("utf8");
}

// Merges a pull request, but only if its head is still the commit the owner approved (sha). Never force.
export async function mergePullRequest(slug: string, repo: string, number: number, sha: string, title: string) {
  const gh = client(slug);
  return gh<{ merged: boolean; sha: string; message: string }>(`/repos/${repo}/pulls/${number}/merge`, {
    method: "PUT",
    body: JSON.stringify({ sha, merge_method: "squash", commit_title: `${title} (#${number})` }),
  });
}

// Raw bytes of a file at a commit (images in a blog PR, for previews before it is merged).
export async function readRepoFileBytes(slug: string, repo: string, path: string, ref: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`, {
    headers: { ...headers(slug), Accept: "application/vnd.github.raw" }, signal: AbortSignal.timeout(20000), cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${path}`);
  return res.arrayBuffer();
}
