// KDP paperback printing cost and royalty, Amazon.com marketplace, black ink, white or cream paper.
// Source: KDP Help "Paperback Printing Cost" (G201834340) and "Paperback royalty" (G201834330), checked 2026-11-27:
//   printing cost = fixed cost + page count x per-page cost
//   royalty = (royalty rate x list price) - printing cost; Expanded Distribution uses 40%.
// Royalty rate is 60% or 50% depending on list price; the 50% band applies to low list prices, so the caller passes
// the rate KDP shows for the book (default 60%). Update the table below if KDP changes its prices.

export interface PrintSpec {
  pages: number;
  // KDP "large trim": more than 6.12 in wide or more than 9 in tall (8.5 x 11 is large).
  widthIn: number;
  heightIn: number;
}

const US_BLACK = {
  shortMaxPages: 110,                         // 24-110 pages: fixed cost only
  short: { regular: 2.3, large: 2.84 },
  long: { fixed: 1.0, perPage: { regular: 0.012, large: 0.017 } },   // 110-828 pages
  maxPages: 828,
};

export const isLargeTrim = (s: Pick<PrintSpec, "widthIn" | "heightIn">) => s.widthIn > 6.12 || s.heightIn > 9;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function printingCostUS(spec: PrintSpec): number {
  if (!Number.isInteger(spec.pages) || spec.pages < 24 || spec.pages > US_BLACK.maxPages) throw new Error(`Black-ink paperbacks have 24-${US_BLACK.maxPages} pages.`);
  const size = isLargeTrim(spec) ? "large" : "regular";
  if (spec.pages <= US_BLACK.shortMaxPages) return US_BLACK.short[size];
  return round2(US_BLACK.long.fixed + spec.pages * US_BLACK.long.perPage[size]);
}

export interface RoyaltyResult {
  printingCost: number;
  amazonRoyalty: number;          // per copy sold on Amazon.com
  expandedRoyalty: number;        // per copy sold through Expanded Distribution
  minListPrice: number;           // printing cost / royalty rate
  breakEvenAcos: number;          // ad spend as a share of list price at which an ad-driven sale earns nothing
}

export function royaltyUS(listPrice: number, spec: PrintSpec, rate: 0.6 | 0.5 = 0.6): RoyaltyResult {
  const printingCost = printingCostUS(spec);
  const amazonRoyalty = round2(rate * listPrice - printingCost);
  return {
    printingCost,
    amazonRoyalty,
    expandedRoyalty: round2(0.4 * listPrice - printingCost),
    minListPrice: round2(printingCost / rate),
    breakEvenAcos: listPrice > 0 ? Math.max(0, Math.round((amazonRoyalty / listPrice) * 1000) / 1000) : 0,
  };
}

// Profit for a period: royalties earned minus ad spend (both from the owner's own KDP and Amazon Ads reports).
export function bookProfit(input: { royalties: number; adSpend: number }) {
  return { profit: round2(input.royalties - input.adSpend), roas: input.adSpend > 0 ? round2(input.royalties / input.adSpend) : null };
}
