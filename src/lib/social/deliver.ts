import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { errorText } from "@/lib/flash";
import { runAutomation } from "@/lib/runs";
import { ADAPTERS, assertSameProject, providerKey } from "@/lib/social";
import { campaignFor, withUtm, type SocialProvider } from "@/lib/social/types";

// Sends one approved post to its own project's channel (Buffer or Postiz). Shared by the Send button and one-click
// publishing. Marks the post queued (or failed, with the error) and returns a sentence for the owner.
export async function deliverPost(ctx: { supabase: SupabaseClient; user: User; project: { id: string; slug: string } }, postId: string): Promise<string> {
  const { supabase, user, project } = ctx;
  const { data: post } = await supabase.from("social_posts").select("*").eq("id", postId).eq("project_id", project.id).single();
  if (!post) throw new Error("Post not found.");
  if (post.status !== "approved") throw new Error("Only approved posts can be sent.");
  const { data: channel } = await supabase.from("social_channels").select("*").eq("id", post.channel_id).eq("project_id", project.id).single();
  if (!channel) throw new Error("This post's channel is not linked to this project.");
  assertSameProject(post, channel);
  const adapter = ADAPTERS[channel.provider as SocialProvider];
  const apiKey = providerKey(adapter.provider, project.slug);
  try {
    const { output } = await runAutomation(supabase, {
      projectId: project.id, kind: "social_send", userId: user.id, input: { postId, provider: adapter.provider, channel: channel.external_id },
      idempotencyKey: `social:${postId}`, attempts: 1,
    }, async (log) => {
      const result = await adapter.send(apiKey, {
        externalChannelId: channel.external_id, service: channel.service, text: post.body,
        linkUrl: withUtm(post.link_url, channel.service, campaignFor(post.link_url)),
        imageUrl: post.image_url, title: post.title, boardServiceId: channel.board_service_id, scheduledFor: post.scheduled_for,
      });
      log(`${adapter.provider} accepted post ${result.externalPostId} for ${channel.display_name || channel.external_id}.`);
      return { output: result };
    });
    const { error } = await supabase.from("social_posts").update({ status: "queued", external_post_id: output.externalPostId, last_error: null }).eq("id", postId);
    if (error) throw error;
    return `${channel.service} post sent to ${adapter.provider} (${post.scheduled_for ? `scheduled ${new Date(post.scheduled_for).toLocaleString("en-US")}` : "next queue slot"}).`;
  } catch (error) {
    await supabase.from("social_posts").update({ status: "failed", last_error: errorText(error).slice(0, 500) }).eq("id", postId);
    throw error;
  }
}

// Is a public URL live? (2xx after redirects.) Used before sending posts that link to a just-merged page or image.
export async function isLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": "GrowthEngine/1.0 (publish check)" }, signal: AbortSignal.timeout(15000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
