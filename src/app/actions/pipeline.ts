"use server";
import { requireProject } from "@/lib/auth";
import { readBlogPullRequest } from "@/lib/content/import-pr";
import { back, errorText } from "@/lib/flash";
import { getPullRequestState, listBlogPullRequests, mergePullRequest } from "@/lib/integrations/github";
import { assertPublishTarget } from "@/lib/projects/registry";
import { scoreArticle } from "@/lib/seo/quality";
import { deliverPost, isLive } from "@/lib/social/deliver";

// The daily loop in one place:
//   1. importBlogPullRequests: blog PRs opened by the daily task (post + pin + social posts) land in the approval queue.
//   2. approveAndPublish (owner, one click): approves the article and its social posts, merges the PR (which deploys
//      the site where auto-deploy is on), and sends the posts to Buffer once the page and image are live.
//   3. sendWhenLive: for posts whose page wasn't live yet at approval time.

const QUEUE = "/queue";
const NETWORK_SERVICE: Record<string, string[]> = {
  pinterest: ["pinterest"], facebook: ["facebook"], instagram: ["instagram"], linkedin: ["linkedin"],
  x: ["twitter", "x"], twitter: ["twitter", "x"], threads: ["threads"], tiktok: ["tiktok"], youtube: ["youtube"],
};

function targetKeywordFor(slug: string) {
  return slug.replace(/-/g, " ").slice(0, 200);
}

export async function importBlogPullRequests(projectId: string) {
  const lines: string[] = [];
  try {
    const { supabase, user, project } = await requireProject(projectId, "editor");
    const manifest = assertPublishTarget(project.slug, project.github_repo);
    const prs = await listBlogPullRequests(project.slug, manifest.repo);
    const { data: known } = await supabase.from("articles").select("pr_number").eq("project_id", projectId).not("pr_number", "is", null);
    const seen = new Set((known ?? []).map((a) => a.pr_number));
    const { data: channels } = await supabase.from("social_channels").select("id, service").eq("project_id", projectId);
    const { data: brand } = await supabase.from("brand_profiles").select("min_quality_score, author_name").eq("project_id", projectId).maybeSingle();
    const fresh = prs.filter((p) => !seen.has(p.number));
    if (!fresh.length) lines.push(prs.length ? `All ${prs.length} open blog PR(s) are already in the queue.` : "No open blog pull requests.");

    for (const pr of fresh) {
      try {
        const imp = await readBlogPullRequest(project.slug, manifest.repo, manifest.publishing.contentPath!, project.site_url, pr);
        const quality = scoreArticle({ title: imp.post.title, metaDescription: imp.post.description, slug: imp.post.slug, targetKeyword: targetKeywordFor(imp.post.slug), body: imp.post.body, sourceCount: imp.post.sources.length }, brand?.min_quality_score ?? 70);
        const { data: article, error } = await supabase.from("articles").insert({
          project_id: projectId, source: "github_pr", slug: imp.post.slug, title: imp.post.title, meta_title: imp.post.title,
          meta_description: imp.post.description, body_markdown: imp.post.body, tags: imp.post.tags, target_keyword: targetKeywordFor(imp.post.slug),
          author_name: brand?.author_name || `${project.name} Team`, status: "draft", quality_score: quality.score, quality_checked_at: new Date().toISOString(),
          generated_by: "claude", scheduled_for: imp.post.date, pr_number: pr.number, pr_url: pr.url, pr_head_sha: pr.headSha, created_by: user.id,
        }).select("id").single();
        if (error) throw error;
        if (imp.post.sources.length) {
          await supabase.from("article_sources").insert(imp.post.sources.map((s) => ({ article_id: article.id, project_id: projectId, url: s.url, title: s.title.slice(0, 300) })));
        }
        let status = "draft";
        if (quality.score >= (brand?.min_quality_score ?? 70)) {
          const { error: e2 } = await supabase.from("articles").update({ status: "in_review" }).eq("id", article.id);
          if (!e2) status = "in_review";
        }
        let posts = 0; const skipped: string[] = [];
        for (const s of imp.social) {
          const services = NETWORK_SERVICE[s.network] ?? [s.network];
          const channel = (channels ?? []).find((c) => services.includes(String(c.service).toLowerCase()));
          if (!channel) { skipped.push(s.network); continue; }
          const { error: e3 } = await supabase.from("social_posts").insert({
            project_id: projectId, channel_id: channel.id, article_id: article.id, body: s.text, title: s.title?.slice(0, 100) || null,
            link_url: s.link?.startsWith("https://") ? s.link : null, image_url: s.image ? imp.imageUrl : null, status: "in_review",
            source_ref: `${manifest.repo}#${pr.number}:${imp.post.slug}:${s.network}`, created_by: user.id,
          });
          if (e3 && !/duplicate|unique/i.test(e3.message)) throw e3;
          if (!e3) posts++;
        }
        lines.push(`PR #${pr.number} "${imp.post.title}": ${status === "in_review" ? "ready for approval" : `saved as draft (quality ${quality.score})`}, ${posts} social post(s)` +
          (skipped.length ? `; no linked channel for ${skipped.join(", ")}` : "") + (imp.warnings.length ? `; ${imp.warnings.join(" ")}` : ""));
      } catch (error) {
        lines.push(`PR #${pr.number}: not imported (${errorText(error)})`);
      }
    }
  } catch (error) {
    back(QUEUE, { error: errorText(error) });
  }
  back(QUEUE, { notice: lines.join(" · ") });
}

// Publishes an approved article's social posts once its page (and pin image) are live.
async function sendIfLive(ctx: Awaited<ReturnType<typeof requireProject>>, articleId: string): Promise<string> {
  const { supabase, project } = ctx;
  const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).eq("project_id", project.id).single();
  if (!article) throw new Error("Article not found.");
  const url = `${String(project.site_url).replace(/\/+$/, "")}/blog/${article.slug}`;
  const { data: posts } = await supabase.from("social_posts").select("id, image_url, status").eq("article_id", articleId).eq("status", "approved");
  const images = [...new Set((posts ?? []).map((p) => p.image_url).filter(Boolean))] as string[];
  const live = await isLive(url) && (await Promise.all(images.map(isLive))).every(Boolean);
  if (!live) return `The page isn't live yet (${url}). Posts are approved and will be sent with "Send when live" once the site has deployed.`;
  if (article.status === "pr_open") {
    await supabase.from("articles").update({ status: "published", published_url: url, published_at: new Date().toISOString() }).eq("id", articleId);
  }
  const sent: string[] = [];
  for (const p of posts ?? []) {
    try { sent.push(await deliverPost(ctx, p.id)); } catch (error) { sent.push(`A post failed: ${errorText(error)}`); }
  }
  return `Live: ${url}. ${sent.length ? sent.join(" ") : "No approved social posts to send."}`;
}

export async function approveAndPublish(projectId: string, articleId: string) {
  let notice = "";
  try {
    const ctx = await requireProject(projectId, "owner");
    const { supabase, project } = ctx;
    const manifest = assertPublishTarget(project.slug, project.github_repo);
    const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).eq("project_id", projectId).single();
    if (!article) throw new Error("Article not found.");
    if (article.source !== "github_pr" || !article.pr_number || !article.pr_head_sha) throw new Error("One-click publishing is for imported blog pull requests.");

    // The PR must still be open and unchanged since it was imported (what the owner reviewed is what gets merged).
    const pr = await getPullRequestState(project.slug, manifest.repo, article.pr_number);
    if (!pr.merged) {
      if (pr.state !== "open") throw new Error(`PR #${article.pr_number} is closed.`);
      if (pr.headSha !== article.pr_head_sha) throw new Error(`PR #${article.pr_number} changed after it was imported. Re-import it before approving.`);
    }

    if (article.status === "in_review") {
      const { error } = await supabase.from("articles").update({ status: "approved" }).eq("id", articleId);
      if (error) throw error;
    }
    const { error: postsError } = await supabase.from("social_posts").update({ status: "approved", review_note: null }).eq("article_id", articleId).eq("status", "in_review");
    if (postsError) throw postsError;
    const { data: fresh } = await supabase.from("articles").select("status").eq("id", articleId).single();
    if (fresh?.status === "approved") {
      const { error } = await supabase.from("articles").update({ status: "pr_open" }).eq("id", articleId);
      if (error) throw error;
    }

    if (!pr.merged) {
      const merged = await mergePullRequest(project.slug, manifest.repo, article.pr_number, article.pr_head_sha, `Blog: ${article.title}`);
      if (!merged.merged) throw new Error(`GitHub didn't merge PR #${article.pr_number}: ${merged.message}`);
    }
    await supabase.from("articles").update({ pr_merged_at: new Date().toISOString() }).eq("id", articleId);
    notice = `Approved and merged PR #${article.pr_number}. ` + await sendIfLive(ctx, articleId);
  } catch (error) {
    back(QUEUE, { error: errorText(error) });
  }
  back(QUEUE, { notice });
}

export async function sendWhenLive(projectId: string, articleId: string) {
  let notice = "";
  try {
    const ctx = await requireProject(projectId, "editor");
    notice = await sendIfLive(ctx, articleId);
  } catch (error) {
    back(QUEUE, { error: errorText(error) });
  }
  back(QUEUE, { notice });
}
