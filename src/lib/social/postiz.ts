// Postiz public API (open source, self-hostable alternative to Buffer: https://docs.postiz.com/public-api).
// Cloud: https://api.postiz.com/public/v1. Self-hosted: https://<your-domain>/api/public/v1 (set POSTIZ_API_URL).
// Header is the raw key (no "Bearer").
import { fetchJson } from "@/lib/retry";
import { postText, type SendInput, type SocialAdapter } from "./types";

export const POSTIZ_CLOUD_API = "https://api.postiz.com/public/v1";
const base = () => (process.env.POSTIZ_API_URL?.trim() || POSTIZ_CLOUD_API).replace(/\/+$/, "");

export function postizPostBody(input: SendInput, now = new Date()) {
  return {
    type: "schedule",
    date: (input.scheduledFor ? new Date(input.scheduledFor) : new Date(now.getTime() + 10 * 60_000)).toISOString(),
    shortLink: false,
    tags: [],
    posts: [{ integration: { id: input.externalChannelId }, value: [{ content: postText(input), image: [] }], settings: { __type: input.service } }],
  };
}

export const postiz: SocialAdapter = {
  provider: "postiz",

  async listChannels(apiKey) {
    const list = await fetchJson<Array<{ id: string; name: string; identifier: string; disabled?: boolean }>>(`${base()}/integrations`, {
      headers: { Authorization: apiKey }, timeoutMs: 20000 });
    return list.filter((i) => !i.disabled).map((i) => ({ externalId: i.id, service: i.identifier, displayName: i.name }));
  },

  async send(apiKey, input) {
    const res = await fetchJson<Array<{ postId: string }>>(`${base()}/posts`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(postizPostBody(input)),
      timeoutMs: 20000,
    });
    if (!res[0]?.postId) throw new Error("Postiz did not return a post id.");
    return { externalPostId: res[0].postId };
  },
};
