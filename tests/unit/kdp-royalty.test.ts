import { describe, expect, it } from "vitest";
import { bookProfit, isLargeTrim, printingCostUS, royaltyUS } from "@/lib/kdp/royalty";

describe("KDP paperback royalty (Amazon.com, black ink)", () => {
  it("matches KDP's own worked examples", () => {
    // KDP help: 300-page regular trim = $1.00 + 300 x $0.012 = $4.60; at $9.99 and 60%: $1.39
    expect(printingCostUS({ pages: 300, widthIn: 6, heightIn: 9 })).toBe(4.6);
    expect(royaltyUS(9.99, { pages: 300, widthIn: 6, heightIn: 9 }).amazonRoyalty).toBe(1.39);
    // KDP help: 333-page regular trim at $15: (0.6 x 15) - $5.00 = $4.00; Expanded Distribution (0.4 x 15) - $5.00 = $1.00
    const r = royaltyUS(15, { pages: 333, widthIn: 6, heightIn: 9 });
    expect([r.printingCost, r.amazonRoyalty, r.expandedRoyalty]).toEqual([5, 4, 1]);
  });

  it("uses the large-trim rate for 8.5 x 11 books", () => {
    expect(isLargeTrim({ widthIn: 8.5, heightIn: 11 })).toBe(true);
    expect(printingCostUS({ pages: 462, widthIn: 8.5, heightIn: 11 })).toBe(8.85);   // 1.00 + 462 x 0.017
    expect(printingCostUS({ pages: 80, widthIn: 8.5, heightIn: 11 })).toBe(2.84);    // short book: fixed only
    expect(() => printingCostUS({ pages: 900, widthIn: 8.5, heightIn: 11 })).toThrow();
  });

  it("computes minimum price, break-even ACOS and profit", () => {
    const r = royaltyUS(24.99, { pages: 462, widthIn: 8.5, heightIn: 11 });
    expect(r.amazonRoyalty).toBe(6.14);
    expect(r.minListPrice).toBe(14.75);
    expect(r.breakEvenAcos).toBe(0.246);
    expect(bookProfit({ royalties: 61.4, adSpend: 20 })).toEqual({ profit: 41.4, roas: 3.07 });
  });
});
