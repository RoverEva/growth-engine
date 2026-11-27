// Rule-based article quality score, 0–100 (engine "rules-1").
//
// Category weights adapted from AgriciDaniel/claude-blog's blog-analyze rubric
// and the AI-phrase list idea from TheCraigHewitt/seomachine's content scorer
// (both MIT). Everything here is deterministic and checkable.
//
// What this does NOT do yet (Phase 2, needs OpenAI): verify that each factual
// claim is true, judge search-intent fit, or judge originality against the web.
// Source URLs are checked for reachability separately (lib/seo/sources.ts).
import { isValidSlug } from "@/lib/content/slug";

export const QUALITY_ENGINE_VERSION = "rules-1";

export interface QualityInput {
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  slug: string;
  targetKeyword: string;
  body: string;
  sourceCount: number; // rows in article_sources
}

export interface QualityCheck {
  id: string;
  category: "metadata" | "structure" | "depth" | "evidence" | "voice";
  points: number;
  max: number;
  passed: boolean;
  message: string;
}

export interface QualityResult {
  score: number;
  passed: boolean;
  hardFails: string[];
  checks: QualityCheck[];
  stats: { words: number; fleschReadingEase: number; avgSentenceWords: number; h2: number; internalLinks: number; externalLinks: number };
}

const AI_CLICHES = [
  /\bin today'?s (?:digital|modern|fast-paced) (?:world|age|landscape)\b/i,
  /\bwhen it comes to\b/i,
  /\bit'?s important to (?:note|remember|understand)\b/i,
  /\bin the (?:world|realm) of\b/i,
  /\blet'?s dive (?:in|into)\b/i,
  /\bdelve\b/i,
  /\bunlock (?:the|your) (?:full )?potential\b/i,
  /\bgame[- ]changer\b/i,
  /\bnavigat(?:e|ing) the (?:complex|ever-changing)\b/i,
  /\bin conclusion\b/i,
  /\bembark on (?:a|your) journey\b/i,
  /\btapestry\b/i,
];

const PLACEHOLDERS = /\b(?:lorem ipsum|TODO|TBD|FIXME)\b|\[(?:insert|add|your)[^\]]*\]/i;

export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+|^\s*\d+\.\s+/gm, "")
    .replace(/^\|.*\|$/gm, (row) => row.replace(/\|/g, " ").replace(/-{3,}/g, " "))
    .replace(/[*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export function readability(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).filter((s) => /[a-z]/i.test(s));
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syllableCount = words.reduce((sum, w) => sum + syllables(w), 0);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = Math.max(1, words.length);
  const flesch = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  return { words: words.length, sentences: sentences.length, avgSentenceWords: wordCount / sentenceCount, flesch: Math.round(flesch * 10) / 10 };
}

function keywordTokens(keyword: string) {
  return keyword.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 || /\d/.test(t));
}

function containsKeyword(text: string, keyword: string) {
  const lower = text.toLowerCase();
  const tokens = keywordTokens(keyword);
  return tokens.length > 0 && tokens.every((t) => lower.includes(t));
}

function scaled(value: number, from: number, to: number, max: number) {
  if (value <= from) return 0;
  if (value >= to) return max;
  return Math.round(((value - from) / (to - from)) * max);
}

export function scoreArticle(input: QualityInput, minScore = 70): QualityResult {
  const checks: QualityCheck[] = [];
  const add = (c: QualityCheck) => checks.push(c);
  const body = input.body ?? "";
  const text = plainText(body);
  const stats = readability(text);
  const h2 = (body.match(/^##\s+\S/gm) ?? []).length;
  const h1InBody = /^#\s+\S/m.test(body);
  const links = [...body.matchAll(/\[[^\]]+\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1]);
  const internalLinks = links.filter((l) => l.startsWith("/")).length;
  const externalLinks = links.filter((l) => /^https?:\/\//.test(l)).length;
  const title = input.metaTitle?.trim() || input.title.trim();
  const description = input.metaDescription?.trim() ?? "";
  const first100 = text.split(/\s+/).slice(0, 100).join(" ");
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^(#|\||[-*+]\s|\d+\.\s|>|```)/.test(p));
  const longParagraphs = paragraphs.filter((p) => (p.match(/[.!?](\s|$)/g) ?? []).length > 4).length;
  const clicheHits = AI_CLICHES.filter((re) => re.test(body)).length;
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim().toLowerCase()).filter((s) => s.split(" ").length > 5);
  const repeated = sentences.length - new Set(sentences).size;
  const hasListOrTable = /^\s*(?:[-*+]|\d+\.)\s+\S/m.test(body) || /^\|.+\|\s*$/m.test(body);
  const hasSourcesSection = /^#{2,3}\s+(?:sources|references)\b/im.test(body);

  // Metadata (20)
  add({ id: "title-length", category: "metadata", max: 5, points: title.length >= 30 && title.length <= 65 ? 5 : title.length >= 20 && title.length <= 75 ? 2 : 0,
    passed: title.length >= 30 && title.length <= 65, message: `SEO title is ${title.length} characters (aim for 30–65).` });
  add({ id: "meta-description", category: "metadata", max: 5, points: description.length >= 120 && description.length <= 155 ? 5 : description.length >= 70 && description.length <= 160 ? 2 : 0,
    passed: description.length >= 120 && description.length <= 155, message: `Meta description is ${description.length} characters (aim for 120–155).` });
  add({ id: "slug", category: "metadata", max: 5, points: isValidSlug(input.slug) && input.slug.length <= 60 ? (containsKeyword(input.slug.replace(/-/g, " "), input.targetKeyword) ? 5 : 3) : 0,
    passed: isValidSlug(input.slug) && input.slug.length <= 60, message: `Slug "${input.slug}" ${isValidSlug(input.slug) ? "is valid" : "must be lowercase words joined by dashes"}${containsKeyword(input.slug.replace(/-/g, " "), input.targetKeyword) ? " and includes the keyword." : "; including the keyword helps."}` });
  add({ id: "keyword-in-title", category: "metadata", max: 5, points: containsKeyword(title, input.targetKeyword) ? 5 : 0,
    passed: containsKeyword(title, input.targetKeyword), message: containsKeyword(title, input.targetKeyword) ? "Title includes the target keyword." : `Title should include "${input.targetKeyword}".` });

  // Structure (20)
  add({ id: "headings", category: "structure", max: 6, points: Math.min(6, Math.round((Math.min(h2, 4) / 4) * 6)) - (h1InBody ? 2 : 0),
    passed: h2 >= 4 && !h1InBody, message: `${h2} section headings (##)${h1InBody ? "; remove the # heading from the body — the title is the page heading" : ""}. Aim for 4+.` });
  add({ id: "list-or-table", category: "structure", max: 4, points: hasListOrTable ? 4 : 0, passed: hasListOrTable,
    message: hasListOrTable ? "Has a list or table readers can scan." : "Add a list or table (steps, word list, comparison)." });
  add({ id: "paragraph-length", category: "structure", max: 5, points: longParagraphs === 0 ? 5 : longParagraphs <= 2 ? 3 : 0, passed: longParagraphs === 0,
    message: longParagraphs === 0 ? "Paragraphs are short." : `${longParagraphs} paragraph(s) have more than 4 sentences; split them.` });
  add({ id: "keyword-early", category: "structure", max: 5, points: containsKeyword(first100, input.targetKeyword) ? 5 : 0, passed: containsKeyword(first100, input.targetKeyword),
    message: containsKeyword(first100, input.targetKeyword) ? "Keyword topic appears in the first 100 words." : "Mention the main topic in the first 100 words." });

  // Depth and readability (25)
  add({ id: "length", category: "depth", max: 10, points: scaled(stats.words, 500, 1200, 10), passed: stats.words >= 1000,
    message: `${stats.words} words. Useful guides here usually need 1,000+.` });
  const fleschOk = stats.flesch >= 55 && stats.flesch <= 80;
  add({ id: "readability", category: "depth", max: 8, points: fleschOk ? 8 : stats.flesch >= 45 && stats.flesch <= 90 ? 4 : 0, passed: fleschOk,
    message: `Reading ease ${stats.flesch} (aim for 55–80 for parents).` });
  add({ id: "sentence-length", category: "depth", max: 7, points: stats.avgSentenceWords <= 20 ? 7 : stats.avgSentenceWords <= 25 ? 4 : 0, passed: stats.avgSentenceWords <= 20,
    message: `Average sentence is ${stats.avgSentenceWords.toFixed(1)} words (aim for 20 or fewer).` });

  // Evidence and links (25)
  const evidenceCount = Math.max(externalLinks, input.sourceCount);
  add({ id: "sources", category: "evidence", max: 10, points: evidenceCount >= 3 ? 10 : evidenceCount === 2 ? 7 : evidenceCount === 1 ? 3 : 0, passed: evidenceCount >= 3,
    message: `${evidenceCount} cited source(s). Cite 3+ authoritative pages (official test sites, research).` });
  add({ id: "sources-section", category: "evidence", max: 5, points: hasSourcesSection ? 5 : 0, passed: hasSourcesSection,
    message: hasSourcesSection ? "Has a Sources section." : "Add a \"## Sources\" section listing the pages used." });
  add({ id: "internal-links", category: "evidence", max: 10, points: internalLinks >= 2 && internalLinks <= 10 ? 10 : internalLinks === 1 ? 5 : internalLinks > 10 ? 6 : 0,
    passed: internalLinks >= 2 && internalLinks <= 10, message: `${internalLinks} internal link(s). Link 2–10 times to your own site's pages (product, pricing, other posts).` });

  // Voice and originality (10)
  add({ id: "cliches", category: "voice", max: 6, points: clicheHits === 0 ? 6 : clicheHits <= 2 ? 3 : 0, passed: clicheHits === 0,
    message: clicheHits === 0 ? "No stock AI phrases found." : `${clicheHits} stock phrase(s) like "delve" or "when it comes to"; rewrite in a natural voice.` });
  add({ id: "repetition", category: "voice", max: 4, points: repeated === 0 ? 4 : 0, passed: repeated === 0,
    message: repeated === 0 ? "No repeated sentences." : `${repeated} repeated sentence(s).` });

  const hardFails: string[] = [];
  if (!input.title.trim()) hardFails.push("Title is missing.");
  if (!description) hardFails.push("Meta description is missing.");
  if (description.length > 160) hardFails.push("Meta description is longer than 160 characters (the blog build rejects it).");
  if (!isValidSlug(input.slug)) hardFails.push("Slug is invalid.");
  if (stats.words < 300) hardFails.push("Article is under 300 words.");
  if (PLACEHOLDERS.test(body)) hardFails.push("Placeholder text found (TODO, lorem ipsum or [insert …]).");

  const score = Math.max(0, Math.min(100, checks.reduce((sum, c) => sum + Math.max(0, c.points), 0)));
  return {
    score,
    passed: hardFails.length === 0 && score >= minScore,
    hardFails,
    checks,
    stats: { words: stats.words, fleschReadingEase: stats.flesch, avgSentenceWords: Math.round(stats.avgSentenceWords * 10) / 10, h2, internalLinks, externalLinks },
  };
}
