import "server-only";
import { redirect } from "next/navigation";

// Server actions finish by redirecting back with a short message in the URL.
export function back(path: string, message: { notice?: string; error?: string }): never {
  const url = new URL(path, "http://local");
  if (message.notice) url.searchParams.set("notice", message.notice.slice(0, 300));
  if (message.error) url.searchParams.set("error", message.error.slice(0, 300));
  redirect(url.pathname + url.search);
}

export function errorText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
