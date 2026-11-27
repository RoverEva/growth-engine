import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseKeywordIdeas } from "@/lib/integrations/dataforseo";
import { HttpError } from "@/lib/retry";

const fixture = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/dataforseo-keyword-ideas.json"), "utf8"));

describe("parseKeywordIdeas", () => {
  it("maps documented fields and drops case/spacing duplicates", () => {
    const { ideas, cost } = parseKeywordIdeas(fixture);
    expect(cost).toBeCloseTo(0.0103);
    expect(ideas.map((i) => i.keyword)).toEqual(["isee vocabulary list", "isee prep course", "erb login"]);
    expect(ideas[0]).toEqual({ keyword: "isee vocabulary list", searchVolume: 880, cpc: 1.25, competition: 0.42, keywordDifficulty: 18, intent: "informational" });
    expect(ideas[2].keywordDifficulty).toBeNull();
    expect(ideas[2].intent).toBe("navigational");
  });

  it("raises a non-retryable error for API-level failures", () => {
    expect(() => parseKeywordIdeas({ status_code: 40100, status_message: "You are not authorized" })).toThrow(HttpError);
    expect(() => parseKeywordIdeas({ status_code: 20000, status_message: "Ok.", tasks: [{ status_code: 40501, status_message: "Invalid Field" }] })).toThrow(/Invalid Field/);
  });
});
