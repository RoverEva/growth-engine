"use server";
import { redirect } from "next/navigation";
import { requireProject } from "@/lib/auth";
import { buildMarkdown } from "@/lib/content/publish";
import { isValidSlug, slugify } from "@/lib/content/slug";
import { back, errorText, field } from "@/lib/flash";
import { getPullRequestState, openArticlePullRequest } from "@/lib/integrations/github";
import { runAutomation } from "@/lib/runs";
import { QUALITY_ENGINE_VERSION, scoreArticle } from "@/lib/seo/quality";
import { checkSourceUrl, isCheckableUrl } from "@/lib/seo/sources";

const articlePath = (projectId: string, articleId: string) => `/p/${projectId}/articles/${articleId}`;

function friendly(error: unknown) {
  const text = errorText(error);
  if (/articles_project_id_target_keyword_normalized_key/.test(text)) return "An article for this target keyword already exists.";
  if (/articles_project_id_slug_key/.test(text)) return "Another article already uses this slug.";
  return text;
}

export async function createArticle(projectId: string, form: FormData) {
  let id = "";
  try {
    const { supabase, user } = await requireProject(projectId, "editor");
    const keywordId = field(form, "keyword_id") || null;
    let targetKeyword = field(form, "target_keyword");
    if (keywordId) {
      const { data: kw } = await supabase.from("keywords").select("keyword").eq("id", keywordId).eq("project_id", projectId).maybeSingle();
      if (!kw) throw new Error("Keyword not found.");
      targetKeyword = kw.keyword;
    }
    if (!targetKeyword) throw new Error("Enter a target keyword.");
    const title = field(form, "title") || targetKeyword.replace(/\b\w/g, (c) => c.toUpperCase());
    const { data: brand } = await supabase.from("brand_profiles").select("author_name").eq("project_id", projectId).maybeSingle();
    const { data, error } = await supabase.from("articles").insert({
      project_id: projectId, keyword_id: keywordId, target_keyword: targetKeyword, title, slug: slugify(title),
      author_name: brand?.author_name ?? "HatchElite Team", created_by: user.id,
    }).select("id").single();
    if (error) throw error;
    if (keywordId) await supabase.from("keywords").update({ status: "in_use" }).eq("id", keywordId);
    id = data.id;
  } catch (error) {
    back(`/p/${projectId}/articles`, { error: friendly(error) });
  }
  redirect(articlePath(projectId, id));
}

export async function saveArticle(projectId: string, articleId: string, form: FormData) {
  const path = articlePath(projectId, articleId);
  try {
    const { supabase } = await requireProject(projectId, "editor");
    const slug = field(form, "slug");
    if (!isValidSlug(slug)) throw new Error("Slug must be lowercase words joined by dashes (max 80 characters).");
    const scheduled = field(form, "scheduled_for");
    const { error } = await supabase.from("articles").update({
      title: field(form, "title"),
      slug,
      meta_title: field(form, "meta_title") || null,
      meta_description: field(form, "meta_description") || null,
      tags: field(form, "tags").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
      scheduled_for: /^\d{4}-\d{2}-\d{2}$/.test(scheduled) ? scheduled : null,
      body_markdown: String(form.get("body_markdown") ?? ""),
      // Content changed: the old score no longer applies.
      quality_score: null,
      quality_checked_at: null,
    }).eq("id", articleId).eq("project_id", projectId);
    if (error) throw error;
  } catch (error) {
    back(path, { error: friendly(error) });
  }
  back(path, { notice: "Saved. Run the quality check before submitting." });
}

export async function addSource(projectId: string, articleId: string, form: FormData) {
  const path = articlePath(projectId, articleId);
  try {
    const { supabase } = await requireProject(projectId, "editor");
    const url = field(form, "url");
    if (!isCheckableUrl(url)) throw new Error("Enter a public http(s) URL.");
    const { error } = await supabase.from("article_sources").insert({
      article_id: articleId, project_id: projectId, url, title: field(form, "title"), publisher: field(form, "publisher"), claim: field(form, "claim"),
    });
    if (error) throw error.code === "23505" ? new Error("That source is already listed.") : error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Source added." });
}

export async function removeSource(projectId: string, articleId: string, sourceId: string) {
  const path = articlePath(projectId, articleId);
  try {
    const { supabase } = await requireProject(projectId, "editor");
    const { error } = await supabase.from("article_sources").delete().eq("id", sourceId).eq("article_id", articleId);
    if (error) throw error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Source removed." });
}

// Rule-based score + live reachability check of every cited source URL.
export async function checkQuality(projectId: string, articleId: string) {
  const path = articlePath(projectId, articleId);
  let notice = "";
  try {
    const { supabase, user } = await requireProject(projectId, "editor");
    const [{ data: article }, { data: sources }, { data: brand }] = await Promise.all([
      supabase.from("articles").select("*").eq("id", articleId).eq("project_id", projectId).single(),
      supabase.from("article_sources").select("id, url").eq("article_id", articleId),
      supabase.from("brand_profiles").select("min_quality_score").eq("project_id", projectId).single(),
    ]);
    if (!article) throw new Error("Article not found.");
    const minScore = brand?.min_quality_score ?? 70;

    const { output } = await runAutomation(supabase, {
      projectId, kind: "quality_check", userId: user.id, input: { articleId }, idempotencyKey: `quality:${articleId}`, attempts: 1,
    }, async (log) => {
      const sourceResults = await Promise.all((sources ?? []).map(async (s) => ({ ...s, result: await checkSourceUrl(s.url) })));
      for (const s of sourceResults) {
        await supabase.from("article_sources").update({ verified: s.result.ok, http_status: s.result.status, checked_at: new Date().toISOString() }).eq("id", s.id);
      }
      const broken = sourceResults.filter((s) => !s.result.ok);
      log(`Checked ${sourceResults.length} source URL(s); ${broken.length} unreachable.`);

      const result = scoreArticle({
        title: article.title, metaDescription: article.meta_description, slug: article.slug,
        targetKeyword: article.target_keyword, body: article.body_markdown, sourceCount: sourceResults.length - broken.length,
      }, minScore);
      const hardFails = [...result.hardFails, ...broken.map((s) => `Source unreachable: ${s.url} (${s.result.status ?? s.result.error})`)];
      const passed = result.passed && broken.length === 0;

      const { error: auditError } = await supabase.from("seo_audits").insert({
        project_id: projectId, article_id: articleId, audit_type: "article_quality", score: result.score, passed,
        checks: [...result.checks, ...hardFails.map((message) => ({ id: "hard-fail", category: "blocking", points: 0, max: 0, passed: false, message }))],
        engine_version: QUALITY_ENGINE_VERSION, created_by: user.id,
      });
      if (auditError) throw new Error(`Saving the audit failed: ${auditError.message}`);
      // A failing hard check caps the stored score below the submission threshold.
      const stored = hardFails.length ? Math.min(result.score, Math.max(0, minScore - 1)) : result.score;
      const { error: updateError } = await supabase.from("articles")
        .update({ quality_score: stored, quality_checked_at: new Date().toISOString() }).eq("id", articleId);
      if (updateError) throw updateError;
      return { output: { score: result.score, passed, blocking: hardFails.length } };
    });
    notice = output.passed
      ? `Quality score ${output.score}/100: passes. You can submit it for review.`
      : `Quality score ${output.score}/100: not ready yet${output.blocking ? ` (${output.blocking} blocking issue(s))` : ""}. See the checks below.`;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice });
}

async function setStatus(projectId: string, articleId: string, minRole: "editor" | "owner", update: Record<string, unknown>, notice: string) {
  const path = articlePath(projectId, articleId);
  try {
    const { supabase } = await requireProject(projectId, minRole);
    const { error } = await supabase.from("articles").update(update).eq("id", articleId).eq("project_id", projectId);
    if (error) throw error; // the database trigger explains blocked transitions
  } catch (error) {
    back(path, { error: friendly(error) });
  }
  back(path, { notice });
}

export async function submitForReview(projectId: string, articleId: string) {
  return setStatus(projectId, articleId, "editor", { status: "in_review" }, "Submitted for review. An owner can approve it now.");
}

export async function approveArticle(projectId: string, articleId: string) {
  return setStatus(projectId, articleId, "owner", { status: "approved", rejection_reason: null }, "Approved. Publish it to open a pull request on the website repo.");
}

export async function rejectArticle(projectId: string, articleId: string, form: FormData) {
  return setStatus(projectId, articleId, "owner", { status: "rejected", rejection_reason: field(form, "reason") || "No reason given" }, "Rejected and sent back to the author.");
}

export async function backToDraft(projectId: string, articleId: string) {
  return setStatus(projectId, articleId, "editor", { status: "draft" }, "Moved back to draft.");
}

// Publishing = a pull request adding the post to the website repo. It goes live
// only after an owner merges the PR and the website is deployed.
export async function publishArticle(projectId: string, articleId: string) {
  const path = articlePath(projectId, articleId);
  let notice = "";
  try {
    const { supabase, user, project } = await requireProject(projectId, "owner");
    if (!project.github_repo) throw new Error("Set the GitHub repository in project settings first.");
    const { data: article } = await supabase.from("articles").select("*").eq("id", articleId).eq("project_id", projectId).single();
    if (!article) throw new Error("Article not found.");
    if (article.status !== "approved") throw new Error("Only approved articles can be published.");
    const markdown = buildMarkdown(article);

    const { output } = await runAutomation(supabase, {
      projectId, kind: "publish_article", userId: user.id, input: { articleId, slug: article.slug }, idempotencyKey: `publish:${articleId}`,
    }, async (log) => {
      const pr = await openArticlePullRequest({
        repo: project.github_repo, baseBranch: project.github_base_branch, contentPath: project.blog_content_path,
        slug: article.slug, markdown, title: article.title,
        prBody: [
          `New blog post from the HatchElite SEO Engine.`,
          ``,
          `- **Target keyword:** ${article.target_keyword}`,
          `- **Quality score:** ${article.quality_score}/100 (engine ${QUALITY_ENGINE_VERSION})`,
          `- **Approved by:** ${user.email ?? user.id}`,
          `- **Publish date:** ${article.scheduled_for ?? "on merge + deploy"}`,
          `- **URL after deploy:** ${project.site_url}/blog/${article.slug}`,
          ``,
          `Merging this PR and deploying the website publishes the post (sitemap, metadata and structured data are generated by the blog build).`,
        ].join("\n"),
      });
      log(`Opened pull request #${pr.number} (${pr.url}).`);
      return { output: pr };
    });
    const { error } = await supabase.from("articles").update({
      status: "pr_open", pr_url: output.url, pr_number: output.number, published_url: `${project.site_url}/blog/${article.slug}`,
    }).eq("id", articleId);
    if (error) throw error;
    notice = `Pull request #${output.number} opened. Merge it and deploy the website to publish.`;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice });
}

export async function refreshPublishStatus(projectId: string, articleId: string) {
  const path = articlePath(projectId, articleId);
  let notice = "";
  try {
    const { supabase, project } = await requireProject(projectId, "owner");
    const { data: article } = await supabase.from("articles").select("status, pr_number").eq("id", articleId).single();
    if (!article?.pr_number || article.status !== "pr_open") throw new Error("This article has no open pull request.");
    const pr = await getPullRequestState(project.github_repo, article.pr_number);
    if (pr.merged) {
      const { error } = await supabase.from("articles").update({ status: "published", published_at: pr.mergedAt }).eq("id", articleId);
      if (error) throw error;
      notice = "The pull request is merged: marked as published. It is live once the website deploy has run.";
    } else {
      notice = pr.state === "closed" ? "The pull request was closed without merging." : "The pull request is still open.";
    }
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice });
}

export async function deleteArticle(projectId: string, articleId: string) {
  try {
    const { supabase } = await requireProject(projectId, "editor");
    const { error, count } = await supabase.from("articles").delete({ count: "exact" }).eq("id", articleId).eq("project_id", projectId);
    if (error) throw error;
    if (!count) throw new Error("Only owners can delete articles that are past draft.");
  } catch (error) {
    back(articlePath(projectId, articleId), { error: errorText(error) });
  }
  back(`/p/${projectId}/articles`, { notice: "Article deleted." });
}
