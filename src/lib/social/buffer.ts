// Buffer's GraphQL API (https://developers.buffer.com). One API key per Buffer account (free plan: 1 key).
// The key can see every channel in the account, so the engine only ever posts to channels linked to the
// post's own project (see social_channels in the database).
import { fetchJson } from "@/lib/retry";
import { postText, type SendInput, type SocialAdapter } from "./types";

export const BUFFER_API = "https://api.buffer.com";

async function graphql<T>(apiKey: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetchJson<{ data?: T; errors?: Array<{ message: string }> }>(BUFFER_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    timeoutMs: 20000,
  });
  if (res.errors?.length) throw new Error(`Buffer: ${res.errors.map((e) => e.message).join("; ")}`);
  if (!res.data) throw new Error("Buffer returned no data.");
  return res.data;
}

export function bufferCreatePostVariables(input: SendInput) {
  return {
    input: {
      text: postText(input),
      channelId: input.externalChannelId,
      schedulingType: "automatic",
      mode: input.scheduledFor ? "customScheduled" : "addToQueue",
      ...(input.scheduledFor ? { dueAt: new Date(input.scheduledFor).toISOString() } : {}),
    },
  };
}

export const buffer: SocialAdapter = {
  provider: "buffer",

  async listChannels(apiKey) {
    const { account } = await graphql<{ account: { organizations: Array<{ id: string; name: string }> } }>(
      apiKey, "query { account { organizations { id name } } }");
    const channels = [];
    for (const org of account.organizations) {
      const data = await graphql<{ channels: Array<{ id: string; name: string; service: string }> }>(
        apiKey, "query Channels($input: ChannelsInput!) { channels(input: $input) { id name service } }",
        { input: { organizationId: org.id } });
      channels.push(...data.channels.map((c) => ({ externalId: c.id, service: c.service, displayName: `${c.name} (${org.name})` })));
    }
    return channels;
  },

  async send(apiKey, input) {
    const data = await graphql<{ createPost: { post?: { id: string }; message?: string } }>(apiKey, `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id } }
          ... on MutationError { message }
        }
      }`, bufferCreatePostVariables(input));
    if (!data.createPost.post) throw new Error(`Buffer refused the post: ${data.createPost.message ?? "unknown error"}`);
    return { externalPostId: data.createPost.post.id };
  },
};
