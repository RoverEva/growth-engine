"use server";
import { requireProject } from "@/lib/auth";
import { back, errorText, field } from "@/lib/flash";
import { deliverPost } from "@/lib/social/deliver";
import type { SocialProvider } from "@/lib/social/types";

const socialPath = (projectId: string) => `/p/${projectId}/social`;
const provider = (value: string): SocialProvider => {
  if (value !== "buffer" && value !== "postiz") throw new Error("Unknown provider.");
  return value;
};
// Where a queue action came from, so we return the user there.
const returnTo = (form: FormData | undefined, fallback: string) => {
  const to = form ? field(form, "return_to") : "";
  return to === "/queue" ? to : fallback;
};

function friendly(error: unknown) {
  const text = errorText(error);
  if (/social_channels_provider_external_key/.test(text)) return "That account is already linked to a project. A channel can belong to one project only.";
  if (/social_posts_channel_same_project/.test(text)) return "That channel belongs to another project.";
  return text;
}

export async function linkChannel(projectId: string, form: FormData) {
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const { error } = await supabase.from("social_channels").insert({
      project_id: projectId, provider: provider(field(form, "provider")), external_id: field(form, "external_id"),
      service: field(form, "service").slice(0, 40), display_name: field(form, "display_name").slice(0, 200),
    });
    if (error) throw error;
  } catch (error) {
    back(socialPath(projectId), { error: friendly(error) });
  }
  back(socialPath(projectId), { notice: "Channel linked to this project." });
}

export async function unlinkChannel(projectId: string, channelId: string) {
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const { error } = await supabase.from("social_channels").delete().eq("id", channelId).eq("project_id", projectId);
    if (error) throw error;
  } catch (error) {
    back(socialPath(projectId), { error: friendly(error) });
  }
  back(socialPath(projectId), { notice: "Channel unlinked. Its posts were removed from the engine (not from Buffer/Postiz)." });
}

export async function createSocialPost(projectId: string, form: FormData) {
  try {
    const { supabase, user } = await requireProject(projectId, "editor");
    const when = field(form, "scheduled_for");
    const link = field(form, "link_url");
    const { error } = await supabase.from("social_posts").insert({
      project_id: projectId, channel_id: field(form, "channel_id"), body: String(form.get("body") ?? "").trim(),
      link_url: link || null, scheduled_for: when ? new Date(when).toISOString() : null,
      image_url: field(form, "image_url") || null, title: field(form, "title") || null,
      status: field(form, "submit") === "draft" ? "draft" : "in_review", created_by: user.id,
    });
    if (error) throw error;
  } catch (error) {
    back(socialPath(projectId), { error: friendly(error) });
  }
  back(socialPath(projectId), { notice: "Post saved. It waits in the approval queue until an owner approves it." });
}

async function setPostStatus(projectId: string, postId: string, form: FormData | undefined, minRole: "owner" | "editor",
  values: Record<string, unknown>, notice: string) {
  const to = returnTo(form, socialPath(projectId));
  try {
    const { supabase } = await requireProject(projectId, minRole);
    const { error, count } = await supabase.from("social_posts").update(values, { count: "exact" }).eq("id", postId).eq("project_id", projectId);
    if (error) throw error;
    if (!count) throw new Error("Post not found.");
  } catch (error) {
    back(to, { error: friendly(error) });
  }
  back(to, { notice });
}

export async function submitSocialPost(projectId: string, postId: string, form?: FormData) {
  return setPostStatus(projectId, postId, form, "editor", { status: "in_review" }, "Submitted for approval.");
}
export async function approveSocialPost(projectId: string, postId: string, form?: FormData) {
  return setPostStatus(projectId, postId, form, "owner", { status: "approved", review_note: null }, "Approved. Send it to the publishing queue when ready.");
}
export async function rejectSocialPost(projectId: string, postId: string, form?: FormData) {
  return setPostStatus(projectId, postId, form, "owner", { status: "rejected", review_note: (form && field(form, "reason")) || "No reason given" }, "Rejected.");
}
export async function deleteSocialPost(projectId: string, postId: string) {
  const path = socialPath(projectId);
  try {
    const { supabase } = await requireProject(projectId, "editor");
    const { error, count } = await supabase.from("social_posts").delete({ count: "exact" }).eq("id", postId).eq("project_id", projectId);
    if (error) throw error;
    if (!count) throw new Error("Only owners can delete posts past draft.");
  } catch (error) {
    back(path, { error: friendly(error) });
  }
  back(path, { notice: "Post deleted." });
}

// Sends an approved post to the project's own channel in Buffer (or Postiz). Buffer/Postiz then publish it at the
// scheduled time or the channel's next queue slot.
export async function sendSocialPost(projectId: string, postId: string, form?: FormData) {
  const to = returnTo(form, socialPath(projectId));
  let notice = "";
  try {
    const ctx = await requireProject(projectId, "editor");
    notice = await deliverPost(ctx, postId);
  } catch (error) {
    back(to, { error: friendly(error) });
  }
  back(to, { notice });
}

// Sets the default Pinterest board for a linked channel (owners only).
export async function setChannelBoard(projectId: string, channelId: string, form: FormData) {
  try {
    const { supabase } = await requireProject(projectId, "owner");
    const [serviceId, ...name] = field(form, "board").split("|");
    const { error } = await supabase.from("social_channels").update({ board_service_id: serviceId || null, board_name: name.join("|") || null })
      .eq("id", channelId).eq("project_id", projectId);
    if (error) throw error;
  } catch (error) {
    back(socialPath(projectId), { error: friendly(error) });
  }
  back(socialPath(projectId), { notice: "Pinterest board saved for this channel." });
}
