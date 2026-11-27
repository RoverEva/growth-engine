import "server-only";
import { MissingConfigError } from "@/lib/env";
import { projectSecret, projectSecretName } from "@/lib/projects/registry";
import { buffer } from "./buffer";
import { postiz } from "./postiz";
import type { SocialAdapter, SocialProvider } from "./types";

export const ADAPTERS: Record<SocialProvider, SocialAdapter> = { buffer, postiz };

const BASE_NAME: Record<SocialProvider, string> = { buffer: "BUFFER_API_KEY", postiz: "POSTIZ_API_KEY" };

// Key lookup: the project's own key (BUFFER_API_KEY__<SLUG>) if set, otherwise the account-level key
// (BUFFER_API_KEY), which is allowed because Buffer's free plan has one key per account. Either way the
// engine only posts to channels linked to the post's own project.
export function providerKey(provider: SocialProvider, slug: string): string {
  const base = BASE_NAME[provider];
  const key = projectSecret(base, slug) ?? (process.env[base]?.trim() || undefined);
  if (!key) throw new MissingConfigError(`${projectSecretName(base, slug)} or ${base}`);
  return key;
}

export function isProviderConfigured(provider: SocialProvider, slug: string): boolean {
  try { providerKey(provider, slug); return true; } catch { return false; }
}

// Last check before a provider call: the channel row must belong to the same project as the post.
export function assertSameProject(post: { project_id: string }, channel: { project_id: string }) {
  if (post.project_id !== channel.project_id) throw new Error("This channel belongs to another project. Posting refused.");
}
