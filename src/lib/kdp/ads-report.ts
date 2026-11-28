// Amazon Ads "Sponsored Products > Search term" report import (CSV exported by the owner from the Amazon Ads console)
// and optimisation suggestions. Suggestions only: the engine never changes bids, budgets or campaigns.
// Approach (column aliases, search-term-level scoring) follows KDP Scout's ads importer (MIT, rxpelle/kdp-scout);
// the code here is our own.

export interface SearchTermRow {
  campaign: string;
  adGroup: string;
  targeting: string;
  matchType: string;
  searchTerm: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
}

// Header names vary by report version and attribution window (7- or 14-day): match case-insensitively by pattern.
const COLUMNS: Record<keyof SearchTermRow, RegExp> = {
  campaign: /^campaign( name)?$/,
  adGroup: /^ad group( name)?$/,
  targeting: /^(targeting|keyword( text)?)$/,
  matchType: /^match type$/,
  searchTerm: /^(customer search term|search term)$/,
  impressions: /^impressions$/,
  clicks: /^clicks$/,
  spend: /^(spend|cost)$/,
  sales: /^(\d+ day )?total sales( \(\S+\))?$|^sales$/,
  orders: /^(\d+ day )?total orders( \(#\))?$|^orders$/,
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function parseSearchTermReport(csv: string): SearchTermRow[] {
  const rows = parseCsv(csv);
  // Some exports start with report metadata lines: the header is the first row that names a search-term column.
  const headerIndex = rows.findIndex((r) => r.some((c) => COLUMNS.searchTerm.test(c.trim().toLowerCase())));
  if (headerIndex < 0) throw new Error("No 'Customer Search Term' column found: export the Sponsored Products search term report as CSV.");
  const header = rows[headerIndex].map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(Object.entries(COLUMNS).map(([k, re]) => [k, header.findIndex((h) => re.test(h))])) as Record<keyof SearchTermRow, number>;
  for (const k of ["searchTerm", "clicks", "spend"] as const) if (idx[k] < 0) throw new Error(`Report is missing the ${k} column.`);
  return rows.slice(headerIndex + 1).map((r) => ({
    campaign: r[idx.campaign] ?? "", adGroup: r[idx.adGroup] ?? "", targeting: r[idx.targeting] ?? "", matchType: (r[idx.matchType] ?? "").toLowerCase(),
    searchTerm: (r[idx.searchTerm] ?? "").trim().toLowerCase(),
    impressions: num(r[idx.impressions]), clicks: num(r[idx.clicks]), spend: num(r[idx.spend]), sales: num(r[idx.sales]), orders: num(r[idx.orders]),
  })).filter((r) => r.searchTerm);
}

export type SuggestionKind = "harvest_exact" | "add_negative" | "lower_bid" | "product_target";
export interface Suggestion { kind: SuggestionKind; searchTerm: string; campaign: string; reason: string; spend: number; orders: number; acos: number | null }

export interface SuggestOptions {
  breakEvenAcos: number;      // from royaltyUS(...).breakEvenAcos
  negativeAfterClicks?: number;   // clicks with no order before suggesting a negative (default 12)
}

export function suggest(rows: SearchTermRow[], opts: SuggestOptions): Suggestion[] {
  const minClicks = opts.negativeAfterClicks ?? 12;
  // Combine the same search term across days/ad groups within a campaign.
  const byKey = new Map<string, SearchTermRow>();
  for (const r of rows) {
    const k = `${r.campaign}\u0000${r.searchTerm}`;
    const prev = byKey.get(k);
    byKey.set(k, prev ? { ...prev, impressions: prev.impressions + r.impressions, clicks: prev.clicks + r.clicks, spend: prev.spend + r.spend, sales: prev.sales + r.sales, orders: prev.orders + r.orders } : { ...r });
  }
  const out: Suggestion[] = [];
  for (const r of byKey.values()) {
    const acos = r.sales > 0 ? Math.round((r.spend / r.sales) * 1000) / 1000 : null;
    const base = { searchTerm: r.searchTerm, campaign: r.campaign, spend: Math.round(r.spend * 100) / 100, orders: r.orders, acos };
    const isAsin = /^b0[0-9a-z]{8}$/.test(r.searchTerm);
    if (r.orders > 0 && r.matchType !== "exact") {
      out.push({ ...base, kind: isAsin ? "product_target" : "harvest_exact", reason: `${r.orders} order(s) from this search: ${isAsin ? "target this product directly" : "add it as an exact-match keyword"}.` });
    }
    if (r.orders === 0 && r.clicks >= minClicks) {
      out.push({ ...base, kind: "add_negative", reason: `${r.clicks} clicks, $${base.spend} spent, no orders: add as a negative exact keyword.` });
    }
    if (acos !== null && acos > opts.breakEvenAcos) {
      out.push({ ...base, kind: "lower_bid", reason: `ACOS ${(acos * 100).toFixed(0)}% is above break-even ${(opts.breakEvenAcos * 100).toFixed(0)}%: lower the bid on its keyword or target.` });
    }
  }
  const order: Record<SuggestionKind, number> = { add_negative: 0, lower_bid: 1, harvest_exact: 2, product_target: 3 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || b.spend - a.spend);
}
