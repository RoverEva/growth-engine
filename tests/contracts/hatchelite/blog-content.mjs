// Loads blog posts from src/content/blog/*.md for the build, the metadata
// plugin and the validators. Each post is one Markdown file with a small
// front-matter block:
//
// ---
// title: ISEE vs SSAT: Which Test Does Your Child Need?
// description: One or two sentences for Google (under 155 characters).
// date: 2026-11-30
// author: HatchElite Team
// tags: [ISEE, SSAT, admissions]
// draft: false
// ---
//
// The file name is the URL: isee-vs-ssat.md -> /blog/isee-vs-ssat
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BLOG_DIR = resolve(projectRoot, "src/content/blog");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    return value.slice(1, -1).split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value.replace(/^["']|["']$/g, "");
}

export function parsePost(source, slug) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Blog post ${slug}: missing front matter`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const index = line.indexOf(":");
    if (index < 1) throw new Error(`Blog post ${slug}: bad front-matter line "${line}"`);
    meta[line.slice(0, index).trim()] = parseValue(line.slice(index + 1));
  }
  const body = match[2].trim();
  if (!SLUG.test(slug)) throw new Error(`Blog post ${slug}: file name must be lowercase-words-with-dashes`);
  if (!meta.title) throw new Error(`Blog post ${slug}: title is required`);
  if (!meta.description || meta.description.length > 160) throw new Error(`Blog post ${slug}: description is required (max 160 characters)`);
  if (!DATE.test(String(meta.date || ""))) throw new Error(`Blog post ${slug}: date must be YYYY-MM-DD`);
  // The page title comes from front matter; drop a leading "# Title" in the body.
  const content = body.replace(/^#\s+.*\r?\n+/, "");
  const words = content.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    path: `/blog/${slug}`,
    title: String(meta.title),
    description: String(meta.description),
    date: String(meta.date),
    author: String(meta.author || "HatchElite Team"),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    draft: meta.draft === true,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    html: marked.parse(content, { gfm: true })
  };
}

// Published posts, newest first. Drafts and future-dated posts are left out.
export function loadBlogPosts({ today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!existsSync(BLOG_DIR)) return [];
  return readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parsePost(readFileSync(resolve(BLOG_DIR, file), "utf8"), basename(file, ".md")))
    .filter((post) => !post.draft && post.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

export function blogMetadataMap(posts) {
  const map = {
    "/blog": {
      title: "HatchElite Blog: ISEE, SSAT & SAT Vocabulary Tips for Parents",
      description: "Practical guides for parents on ISEE, SSAT and SAT prep, vocabulary lists, reading practice and private school admissions."
    }
  };
  for (const post of posts) {
    map[post.path] = {
      title: `${post.title} | HatchElite`,
      description: post.description,
      article: { headline: post.title, datePublished: post.date, author: post.author }
    };
  }
  return map;
}
