// URL slugs that match the website's blog rule: lowercase words joined by dashes.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "of", "to", "for", "in", "on", "with", "your", "is", "are", "how", "what"]);

export function slugify(input: string, maxLength = 60): string {
  const words = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  // Drop filler words when the slug would be long, but keep at least 3 words.
  const trimmed = words.length > 5 ? words.filter((w, i) => i === 0 || !STOP_WORDS.has(w)) : words;
  const chosen = trimmed.length >= 3 ? trimmed : words;
  let slug = "";
  for (const word of chosen) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > maxLength) break;
    slug = next;
  }
  return slug || "post";
}

export function isValidSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && slug.length <= 80;
}
