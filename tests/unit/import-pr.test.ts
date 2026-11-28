import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseFrontMatter, sourcesFrom } from "@/lib/content/import-pr";

const POST = `---
title: How to Study SSAT Analogies: 6 Relationship Types with Examples
description: Learn the 6 relationship types behind most SSAT analogies.
date: 2026-11-28
author: HatchElite Team
tags: [SSAT, SSAT Middle Level, Analogies]
---

Intro paragraph.

## Sources

- [What's on the Upper Level SSAT (admission.org)](https://admission.org/help/whats-on-the-upper-level-ssat) – section lengths
- [SSAT test levels (ssat.org)](https://ssat.org/pages/levels) – levels
`;

describe("blog PR import", () => {
  it("reads front matter with colons in the title and list tags", () => {
    const { meta, body } = parseFrontMatter(POST);
    expect(meta.title).toBe("How to Study SSAT Analogies: 6 Relationship Types with Examples");
    expect(meta.tags).toEqual(["SSAT", "SSAT Middle Level", "Analogies"]);
    expect(meta.date).toBe("2026-11-28");
    expect(body.startsWith("Intro paragraph.")).toBe(true);
  });

  it("collects the links in the Sources section only", () => {
    const { body } = parseFrontMatter(POST.replace("Intro paragraph.", "See [pricing](/pricing) and [ERB](https://erblearn.org)."));
    expect(sourcesFrom(body).map((s) => s.url)).toEqual(["https://admission.org/help/whats-on-the-upper-level-ssat", "https://ssat.org/pages/levels"]);
  });

  it("refuses a file without front matter", () => {
    expect(() => parseFrontMatter("# Just a heading")).toThrow(/front matter/);
  });
});
