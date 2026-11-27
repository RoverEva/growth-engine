import { afterEach, describe, expect, it } from "vitest";
import { assertPublishTarget, envSuffix, getManifest, projectSecret } from "@/lib/projects/registry";

describe("project registry and isolation", () => {
  afterEach(() => {
    delete process.env.GITHUB_TOKEN__HATCHELITE;
    delete process.env.GITHUB_TOKEN__EVA_VIDEO_STUDIO;
  });

  it("loads both manifests from projects/", () => {
    expect(getManifest("hatchelite")?.repo).toBe("RoverEva/hatchelite");
    expect(getManifest("eva-video-studio")?.publishing.enabled).toBe(false);
    expect(getManifest("hatchelite")?.topicTerms.isee).toBe(30);
    expect(getManifest("hatchelite")?.topicTerms.$comment).toBeUndefined();
  });

  it("scopes secrets by project and never falls back", () => {
    expect(envSuffix("eva-video-studio")).toBe("EVA_VIDEO_STUDIO");
    process.env.GITHUB_TOKEN__HATCHELITE = "he-token";
    expect(projectSecret("GITHUB_TOKEN", "hatchelite")).toBe("he-token");
    expect(projectSecret("GITHUB_TOKEN", "eva-video-studio")).toBeUndefined();
    expect(() => envSuffix("../x")).toThrow();
  });

  it("refuses to publish to another project's repository", () => {
    expect(assertPublishTarget("hatchelite", "rovereva/HatchElite").publishing.contentPath).toBe("hatchelite-v2-clean/src/content/blog");
    expect(() => assertPublishTarget("hatchelite", "RoverEva/Eva-Video-Studio")).toThrow(/may only publish to RoverEva\/hatchelite/);
    expect(() => assertPublishTarget("eva-video-studio", "RoverEva/Eva-Video-Studio")).toThrow(/Publishing is off/);
    expect(() => assertPublishTarget("unknown", "a/b")).toThrow(/manifest/);
  });
});
