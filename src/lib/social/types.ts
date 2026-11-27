// Shared shapes for social publishing providers. Providers never decide which brand a post belongs to:
// the engine checks that the channel is linked to the post's project before calling them.
export type SocialProvider = "buffer" | "postiz";

export interface ProviderChannel {
  externalId: string;
  service: string;
  displayName: string;
}

export interface SendInput {
  externalChannelId: string;
  service: string;
  text: string;
  linkUrl?: string | null;
  // Null: the provider's next free queue slot.
  scheduledFor?: string | null;
}

export interface SendResult {
  externalPostId: string;
}

export interface SocialAdapter {
  provider: SocialProvider;
  listChannels(apiKey: string): Promise<ProviderChannel[]>;
  send(apiKey: string, input: SendInput): Promise<SendResult>;
}

export function postText(input: Pick<SendInput, "text" | "linkUrl">): string {
  const text = input.text.trim();
  return input.linkUrl && !text.includes(input.linkUrl) ? `${text}\n\n${input.linkUrl}` : text;
}
