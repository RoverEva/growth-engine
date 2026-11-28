import { NextResponse, type NextRequest } from "next/server";
import { readRepoFileBytes } from "@/lib/integrations/github";
import { getManifest } from "@/lib/projects/registry";
import { supabaseServer } from "@/lib/supabase/server";

// Serves a social post's image from its blog pull request, so the owner can see the pin before the PR is merged.
// Only for signed-in members of the post's project (row-level security decides), only images under public/.
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get("post") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(postId)) return new NextResponse("bad request", { status: 400 });
  const supabase = await supabaseServer();
  const { data: post } = await supabase.from("social_posts").select("image_url, project_id, articles(pr_head_sha), projects(slug, site_url, github_repo)").eq("id", postId).maybeSingle();
  const article = post?.articles as unknown as { pr_head_sha: string | null } | null;
  const project = post?.projects as unknown as { slug: string; site_url: string; github_repo: string } | null;
  const manifest = getManifest(project?.slug);
  if (!post?.image_url || !article?.pr_head_sha || !project || !manifest?.publishing.contentPath) return new NextResponse("not found", { status: 404 });
  const site = project.site_url.replace(/\/+$/, "");
  if (!post.image_url.startsWith(`${site}/`)) return new NextResponse("not found", { status: 404 });
  const rel = post.image_url.slice(site.length + 1);
  if (!/^[a-z0-9/_-]+\.(jpg|jpeg|png|webp)$/i.test(rel) || rel.includes("..")) return new NextResponse("not found", { status: 404 });
  const appDir = manifest.publishing.contentPath.split("/src/")[0];
  try {
    const bytes = await readRepoFileBytes(project.slug, manifest.repo, `${appDir}/public/${rel}`, article.pr_head_sha);
    const type = rel.endsWith(".png") ? "image/png" : rel.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new NextResponse(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
