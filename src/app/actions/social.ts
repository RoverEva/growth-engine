"use server";
import { requireProject } from "@/lib/auth";
import { back, errorText, field } from "@/lib/flash";
import { runAutomation } from "@/lib/runs";
import { ADAPTERS, assertSameProject, providerKey } from "@/lib/social";
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
    const { supabase, user, project } = await requireProject(projectId, "editor");
    const { data: post } = await supabase.from("social_posts").select("*").eq("id", postId).eq("project_id", projectId).single();
    if (!post) throw new Error("Post not found.");
    if (post.status !== "approved") throw new Error("Only approved posts can be sent.");
    const { data: channel } = await supabase.from("social_channels").select("*").eq("id", post.channel_id).eq("project_id", projectId).single();
    if (!channel) throw new Error("This post's channel is not linked to this project.");
    assertSameProject(post, channel);
    const adapter = ADAPTERS[channel.provider as SocialProvider];
    const apiKey = providerKey(adapter.provider, project.slug);

    try {
      const { output } = await runAutomation(supabase, {
        projectId, kind: "social_send", userId: user.id, input: { postId, provider: adapter.provider, channel: channel.external_id },
        idempotencyKey: `social:${postId}`, attempts: 1,
      }, async (log) => {
        const result = await adapter.send(apiKey, {
          externalChannelId: channel.external_id, service: channel.service, text: post.body, linkUrl: post.link_url, scheduledFor: post.scheduled_for,
        });
        log(`${adapter.provider} accepted post ${result.externalPostId} for ${channel.display_name || channel.external_id}.`);
        return { output: result };
      });
      const { error } = await supabase.from("social_posts").update({ status: "queued", external_post_id: output.externalPostId, last_error: null }).eq("id", postId);
      if (error) throw error;
      notice = `Sent to ${adapter.provider}. It publishes ${post.scheduled_for ? `at ${new Date(post.scheduled_for).toLocaleString("en-US")}` : "at the channel's next queue slot"}.`;
    } catch (error) {
      await supabase.from("social_posts").update({ status: "failed", last_error: errorText(error).slice(0, 500) }).eq("id", postId);
      throw error;
    }
  } catch (error) {
    back(to, { error: friendly(error) });
  }
  back(to, { notice });
}
