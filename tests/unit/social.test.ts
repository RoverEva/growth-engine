import { afterEach, describe, expect, it, vi } from "vitest";
import { buffer, bufferCreatePostVariables } from "@/lib/social/buffer";
import { postiz, postizPostBody } from "@/lib/social/postiz";
import { campaignFor, postText, withUtm } from "@/lib/social/types";

vi.mock("server-only", () => ({}));

afterEach(() => vi.unstubAllGlobals());

describe("social adapters", () => {
  it("appends the link once", () => {
    expect(postText({ text: "New guide", linkUrl: "https://hatchelite.com/blog/x", service: "facebook" })).toBe("New guide\n\nhttps://hatchelite.com/blog/x");
    expect(postText({ text: "See https://a.com", linkUrl: "https://a.com", service: "facebook" })).toBe("See https://a.com");
    // Pinterest: the link is the pin's destination, not part of the description.
    expect(postText({ text: "Pin text", linkUrl: "https://a.com", service: "pinterest" })).toBe("Pin text");
  });

  it("builds Buffer queue and scheduled posts", () => {
    expect(bufferCreatePostVariables({ externalChannelId: "c1", service: "linkedin", text: "Hi" }).input)
      .toEqual({ text: "Hi", channelId: "c1", schedulingType: "automatic", mode: "addToQueue", needsApproval: false, assets: [], source: "growth-engine" });
    expect(bufferCreatePostVariables({ externalChannelId: "c1", service: "linkedin", text: "Hi", scheduledFor: "2026-12-01T17:00:00Z" }).input)
      .toMatchObject({ mode: "customScheduled", dueAt: "2026-12-01T17:00:00.000Z" });
  });

  it("sends to Buffer with a bearer key and reads the post id", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { createPost: { post: { id: "p9" } } } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(buffer.send("k", { externalChannelId: "c1", service: "linkedin", text: "Hi" })).resolves.toEqual({ externalPostId: "p9" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.buffer.com");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });

  it("surfaces Buffer's refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { createPost: { message: "Channel paused" } } }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(buffer.send("k", { externalChannelId: "c1", service: "x", text: "Hi" })).rejects.toThrow(/Channel paused/);
  });

  it("builds a Postiz scheduled post and uses the raw key", async () => {
    const body = postizPostBody({ externalChannelId: "i1", service: "linkedin", text: "Hi" }, new Date("2026-12-01T00:00:00Z"));
    expect(body).toMatchObject({ type: "schedule", date: "2026-12-01T00:10:00.000Z", posts: [{ integration: { id: "i1" }, settings: { __type: "linkedin" } }] });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ postId: "z1", integration: "i1" }]), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(postiz.send("raw", { externalChannelId: "i1", service: "linkedin", text: "Hi" })).resolves.toEqual({ externalPostId: "z1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.postiz.com/public/v1/posts");
    expect((init.headers as Record<string, string>).Authorization).toBe("raw");
  });

  it("builds a Pinterest pin with image, board, title and destination URL", () => {
    const v = bufferCreatePostVariables({ externalChannelId: "p1", service: "pinterest", text: "Learn the 6 types", title: "SSAT Analogies",
      imageUrl: "https://hatchelite.com/pins/x.jpg", boardServiceId: "b42", linkUrl: "https://hatchelite.com/blog/x?utm_source=pinterest", scheduledFor: "2026-12-01T17:00:00Z" }).input;
    expect(v).toMatchObject({ text: "Learn the 6 types", mode: "customScheduled", dueAt: "2026-12-01T17:00:00.000Z", needsApproval: false,
      assets: [{ image: { url: "https://hatchelite.com/pins/x.jpg" } }],
      metadata: { pinterest: { boardServiceId: "b42", title: "SSAT Analogies", url: "https://hatchelite.com/blog/x?utm_source=pinterest" } } });
    expect(() => bufferCreatePostVariables({ externalChannelId: "p1", service: "pinterest", text: "x", boardServiceId: "b" })).toThrow(/need an image/);
    expect(() => bufferCreatePostVariables({ externalChannelId: "p1", service: "pinterest", text: "x", imageUrl: "https://a/x.jpg" })).toThrow(/board/);
    expect(() => bufferCreatePostVariables({ externalChannelId: "c", service: "facebook", text: "x", imageUrl: "http://a/x.jpg" })).toThrow(/https/);
  });

  it("tags links with UTM parameters without overwriting existing ones", () => {
    expect(withUtm("https://hatchelite.com/blog/how-to-study-ssat-analogies", "Pinterest", campaignFor("https://hatchelite.com/blog/how-to-study-ssat-analogies")))
      .toBe("https://hatchelite.com/blog/how-to-study-ssat-analogies?utm_source=pinterest&utm_medium=social&utm_campaign=how-to-study-ssat-analogies");
    expect(withUtm("https://a.com/?utm_source=newsletter", "facebook", "x")).toBe("https://a.com/?utm_source=newsletter&utm_medium=social&utm_campaign=x");
    expect(withUtm(null, "facebook", "x")).toBeNull();
    expect(campaignFor("https://evavideostudio.com/pricing.html")).toBe("social");
  });
});
