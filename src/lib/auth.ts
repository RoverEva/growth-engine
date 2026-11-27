import "server-only";
import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "owner" | "editor" | "viewer";
const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export async function requireUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

// Loads the project and the caller's role. Row-level security already hides
// projects the user isn't a member of; this adds the minimum-role check.
export async function requireProject(projectId: string, minRole: Role = "viewer") {
  const { supabase, user } = await requireUser();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) notFound();
  const { data: membership } = await supabase
    .from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  const role = (membership?.role ?? "viewer") as Role;
  if (RANK[role] < RANK[minRole]) {
    throw new Error(`This action needs the ${minRole} role. Your role is ${role}.`);
  }
  return { supabase, user, project, role };
}

export function canEdit(role: Role) {
  return RANK[role] >= RANK.editor;
}
