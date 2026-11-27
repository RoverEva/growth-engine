"use server";
import { redirect } from "next/navigation";
import { requireProject, requireUser } from "@/lib/auth";
import { back, errorText, field } from "@/lib/flash";
import { getManifest } from "@/lib/projects/registry";

export async function createProject(form: FormData) {
  const { supabase } = await requireUser();
  // A project must exist in the knowledge base (projects/<slug>/PROJECT.json) before the engine can manage it.
  const manifest = getManifest(field(form, "slug"));
  if (!manifest) back("/", { error: "Choose a project from the knowledge base. Add projects/<slug>/PROJECT.json first." });
  const { data, error } = await supabase.rpc("create_project", {
    p_name: manifest.name, p_site_url: manifest.siteUrl, p_slug: manifest.slug, p_github_repo: manifest.repo,
  });
  if (error) back("/", { error: `Could not create the project: ${error.message}` });
  redirect(`/p/${data}`);
}

export async function updateProject(projectId: string, form: FormData) {
  const path = `/p/${projectId}/settings`;
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const { error } = await supabase.from("projects").update({
      name: field(form, "name"),
      site_url: field(form, "site_url").replace(/\/+$/, ""),
      default_location_code: Number(field(form, "default_location_code")) || 2840,
      default_language_code: field(form, "default_language_code") || "en",
    }).eq("id", projectId);
    if (error) throw error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Project settings saved." });
}

export async function updateBrand(projectId: string, form: FormData) {
  const path = `/p/${projectId}/settings`;
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const minScore = Number(field(form, "min_quality_score"));
    const { error } = await supabase.from("brand_profiles").update({
      brand_name: field(form, "brand_name"),
      audience: field(form, "audience"),
      voice: field(form, "voice"),
      products: field(form, "products"),
      topics_to_avoid: field(form, "topics_to_avoid"),
      author_name: field(form, "author_name") || `${field(form, "brand_name") || "Site"} Team`,
      min_quality_score: Number.isFinite(minScore) ? Math.min(100, Math.max(0, Math.round(minScore))) : 70,
    }).eq("project_id", projectId);
    if (error) throw error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Brand profile saved." });
}

export async function addMember(projectId: string, form: FormData) {
  const path = `/p/${projectId}/settings`;
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const role = field(form, "role");
    if (!["owner", "editor", "viewer"].includes(role)) throw new Error("Choose a role.");
    const { error } = await supabase.rpc("add_member_by_email", { p_project: projectId, p_email: field(form, "email"), p_role: role });
    if (error) throw error;
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Member saved." });
}

export async function removeMember(projectId: string, userId: string) {
  const path = `/p/${projectId}/settings`;
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const { error, count } = await supabase.from("project_members").delete({ count: "exact" }).eq("project_id", projectId).eq("user_id", userId);
    if (error) throw error;
    if (!count) throw new Error("You can't remove yourself.");
  } catch (error) {
    back(path, { error: errorText(error) });
  }
  back(path, { notice: "Member removed." });
}
