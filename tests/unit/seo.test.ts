import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { businessRelevance, opportunityScore } from "@/lib/seo/opportunity";
import { scoreArticle } from "@/lib/seo/quality";
import { getManifest } from "@/lib/projects/registry";

const he = getManifest("hatchelite")!.topicTerms;
const eva = getManifest("eva-video-studio")!.topicTerms;
const score = (keyword: string, searchVolume: number, keywordDifficulty: number, intent: string) =>
  opportunityScore({ keyword, searchVolume, keywordDifficulty, intent }, businessRelevance(keyword, he));

describe("opportunity score", () => {
  it("prefers relevant, reachable keywords", () => {
    const good = score("isee vocabulary list", 880, 18, "informational");
    const hard = score("isee vocabulary list", 880, 85, "informational");
    const offTopic = score("erb login", 2400, 10, "navigational");
    expect(good).toBeGreaterThan(hard);
    expect(offTopic).toBe(0);
    expect(businessRelevance("3rd grade vocabulary words", he)).toBeGreaterThan(20);
    // Each project scores against its own terms only.
    expect(businessRelevance("isee vocabulary list", eva)).toBe(0);
    expect(businessRelevance("talking head video captions", he)).toBe(0);
    expect(businessRelevance("talking head video captions", eva)).toBeGreaterThan(20);
    expect(good).toBeGreaterThanOrEqual(0);
    expect(good).toBeLessThanOrEqual(100);
  });
});

describe("scoreArticle", () => {
  const thin = scoreArticle({ title: "Words", metaDescription: "", slug: "Bad Slug", targetKeyword: "isee vocabulary", body: "TODO write this. It's important to note that we delve.", sourceCount: 0 });

  it("fails thin, placeholder articles with clear reasons", () => {
    expect(thin.passed).toBe(false);
    expect(thin.score).toBeLessThan(40);
    expect(thin.hardFails.join(" ")).toMatch(/Meta description is missing/);
    expect(thin.hardFails.join(" ")).toMatch(/Placeholder/);
    expect(thin.checks.find((c) => c.id === "cliches")?.passed).toBe(false);
  });

  it("keeps every check within its points", () => {
    for (const check of thin.checks) {
      expect(check.points).toBeLessThanOrEqual(check.max);
    }
    expect(thin.checks.reduce((s, c) => s + c.max, 0)).toBe(100);
  });

  const post = resolve(__dirname, "../fixtures/hatchelite/isee-vs-ssat.md");
  it("scores the published HatchElite ISEE vs SSAT post as passing", () => {
    const source = readFileSync(post, "utf8");
    const body = source.replace(/^---[\s\S]*?---\n/, "");
    const description = source.match(/^description: (.*)$/m)?.[1] ?? "";
    const result = scoreArticle({
      title: "ISEE vs SSAT: Which Test Does Your Child Need?", metaDescription: description, slug: "isee-vs-ssat",
      targetKeyword: "isee vs ssat", body, sourceCount: 5,
    });
    expect(result.hardFails).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });
});
