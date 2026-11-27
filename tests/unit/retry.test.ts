import { describe, expect, it } from "vitest";
import { HttpError, isRetryable, withRetry } from "@/lib/retry";

const noSleep = async () => {};

describe("withRetry", () => {
  it("retries temporary failures and then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new HttpError("busy", 503);
      return "ok";
    }, { sleep: noSleep });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry permanent failures", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new HttpError("bad key", 401); }, { sleep: noSleep })).rejects.toThrow("bad key");
    expect(calls).toBe(1);
  });

  it("gives up after the attempt limit", async () => {
    let calls = 0;
    await expect(withRetry(async () => { calls++; throw new HttpError("rate", 429); }, { attempts: 4, sleep: noSleep })).rejects.toThrow("rate");
    expect(calls).toBe(4);
  });

  it("classifies errors", () => {
    expect(isRetryable(new HttpError("x", 500))).toBe(true);
    expect(isRetryable(new HttpError("x", 404))).toBe(false);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(new Error("validation"))).toBe(false);
  });
});
