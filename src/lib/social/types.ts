// Shared shapes for social publishing providers. Providers never decide which brand a post belongs to:
// the engine checks that the channel is linked to the post's project before calling them.
export type SocialProvider = "buffer" | "postiz";

export interface ProviderChannel {
  externalId: string;
  service: string;
  displayName: string;
}

export interface ProviderBoard {
  serviceId: string;
  name: string;
}

export interface SendInput {
  externalChannelId: string;
  service: string;
  text: string;
  // Destination link. Tagged with UTM parameters before sending (see withUtm).
  linkUrl?: string | null;
  // Public https image URL (required for Pinterest). Buffer has no upload endpoint.
  imageUrl?: string | null;
  // Pinterest only: pin title and board (Buffer's PinterestBoard.serviceId).
  title?: string | null;
  boardServiceId?: string | null;
  // Null: the provider's next free queue slot.
  scheduledFor?: string | null;
}

export interface SendResult {
  externalPostId: string;
}

export interface SocialAdapter {
  provider: SocialProvider;
  listChannels(apiKey: string): Promise<ProviderChannel[]>;
  listBoards?(apiKey: string, externalChannelId: string): Promise<ProviderBoard[]>;
  send(apiKey: string, input: SendInput): Promise<SendResult>;
}

export const isPinterest = (service: string) => service.toLowerCase() === "pinterest";

// Networks where the link is a separate field (the pin's click-through), not part of the text.
export function postText(input: Pick<SendInput, "text" | "linkUrl" | "service">): string {
  const text = input.text.trim();
  if (isPinterest(input.service)) return text;
  return input.linkUrl && !text.includes(input.linkUrl) ? `${text}\n\n${input.linkUrl}` : text;
}

// UTM tags so analytics can attribute visits to the network and post: utm_source=<network>, utm_medium=social,
// utm_campaign=<campaign>. Existing utm_* values on the link are kept. Only the brand's own https links are tagged.
export function withUtm(link: string | null | undefined, service: string, campaign: string): string | null {
  if (!link) return null;
  let url: URL;
  try { url = new URL(link); } catch { return link; }
  if (url.protocol !== "https:") return link;
  const set = (k: string, v: string) => { if (!url.searchParams.has(k)) url.searchParams.set(k, v); };
  set("utm_source", service.toLowerCase() || "social");
  set("utm_medium", "social");
  set("utm_campaign", campaign.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "social");
  return url.toString();
}

// The campaign name for a post: the blog slug of its link (…/blog/<slug>) or "social".
export function campaignFor(link: string | null | undefined): string {
  const m = link?.match(/\/blog\/([a-z0-9-]+)/i);
  return m ? m[1] : "social";
}
