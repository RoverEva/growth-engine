import { toBlogMarkdown } from "@/lib/content/markdown";

// The exact file that publishing will commit to the website repo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMarkdown(article: Record<string, any>) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  return toBlogMarkdown({
    title: article.title,
    metaDescription: article.meta_description ?? "",
    date: article.scheduled_for ?? today,
    author: article.author_name,
    tags: article.tags ?? [],
    body: article.body_markdown,
  });
}

