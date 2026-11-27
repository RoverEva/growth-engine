// Builds the Markdown file the website's blog expects
// (hatchelite-v2-clean/scripts/blog-content.mjs): front matter + body.
export interface ArticleForPublish {
  title: string;
  metaDescription: string;
  date: string; // YYYY-MM-DD
  author: string;
  tags: string[];
  body: string;
}

function clean(value: string) {
  // Front matter is one "key: value" per line; keep values on one line.
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function toBlogMarkdown(article: ArticleForPublish): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date)) throw new Error("date must be YYYY-MM-DD");
  const description = clean(article.metaDescription);
  if (!description || description.length > 160) throw new Error("meta description must be 1–160 characters");
  const tags = article.tags.map((tag) => clean(tag).replace(/[,[\]]/g, "")).filter(Boolean);
  // The page title comes from front matter; a leading "# Title" in the body would duplicate it.
  const body = article.body.replace(/^\s*#\s+.*\r?\n+/, "").trim();
  return [
    "---",
    `title: ${clean(article.title)}`,
    `description: ${description}`,
    `date: ${article.date}`,
    `author: ${clean(article.author)}`,
    `tags: [${tags.join(", ")}]`,
    "---",
    "",
    body,
    "",
  ].join("\n");
}
