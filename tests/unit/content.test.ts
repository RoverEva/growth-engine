import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { toBlogMarkdown } from "@/lib/content/markdown";
import { isValidSlug, slugify } from "@/lib/content/slug";

describe("slugify", () => {
  it("makes blog-compatible slugs", () => {
    expect(slugify("ISEE vs SSAT: Which Test Does Your Child Need?")).toBe("isee-vs-ssat-which-test-does-child-need");
    expect(slugify("Café & Crème — 3rd Grade Words!")).toBe("cafe-creme-3rd-grade-words");
    expect(isValidSlug(slugify("   "))).toBe(true);
    expect(slugify("a".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe("toBlogMarkdown", () => {
  const article = {
    title: "ISEE Lower Level Vocabulary: 100 Words With Sentences",
    metaDescription: "A list of 100 ISEE Lower Level vocabulary words with simple definitions, example sentences and a study plan for parents.",
    date: "2026-12-01",
    author: "HatchElite Team",
    tags: ["ISEE", "Vocabulary, lists"],
    body: "# Duplicate title\n\nIntro paragraph.\n\n## Section\n\nText.",
  };

  it("writes front matter and strips a duplicate H1", () => {
    const md = toBlogMarkdown(article);
    expect(md.startsWith("---\ntitle: ISEE Lower Level Vocabulary: 100 Words With Sentences\n")).toBe(true);
    expect(md).toContain("tags: [ISEE, Vocabulary lists]");
    expect(md).not.toContain("# Duplicate title");
  });

  it("rejects descriptions the blog build would reject", () => {
    expect(() => toBlogMarkdown({ ...article, metaDescription: "x".repeat(161) })).toThrow();
    expect(() => toBlogMarkdown({ ...article, date: "Dec 1" })).toThrow();
  });

  // Contract test against HatchElite's real blog loader (pinned copy, see tests/contracts/hatchelite/README.md).
  const loader = resolve(__dirname, "../contracts/hatchelite/blog-content.mjs");
  it("is accepted by HatchElite's blog loader", async () => {
    const { parsePost } = await import(pathToFileURL(loader).href);
    const post = parsePost(toBlogMarkdown(article), "isee-lower-level-vocabulary");
    expect(post.title).toBe(article.title);
    expect(post.description).toBe(article.metaDescription);
    expect(post.date).toBe("2026-12-01");
    expect(post.tags).toEqual(["ISEE", "Vocabulary lists"]);
    expect(post.html).toContain("<h2>Section</h2>");
  });
});
