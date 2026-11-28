import { describe, expect, it } from "vitest";
import { parseSearchTermReport, suggest } from "@/lib/kdp/ads-report";

const CSV = `﻿Report: Sponsored Products Search term report
"Date","Campaign Name","Ad Group Name","Targeting","Match Type","Customer Search Term","Impressions","Clicks","Spend","14 Day Total Sales ","14 Day Total Orders (#)"
"Nov 20, 2026","Middle - Auto","Auto","*","-","ssat middle level vocabulary","900","14","$9.80","$49.98","2"
"Nov 21, 2026","Middle - Auto","Auto","*","-","ssat middle level vocabulary","300","3","$2.10","$0.00","0"
"Nov 20, 2026","Middle - Auto","Auto","*","-","vocabulary workbook grade 2","2000","15","$10.50","$0.00","0"
"Nov 20, 2026","Middle - Broad","Broad","isee vocabulary","BROAD","isee upper level vocabulary book","400","9","$8.10","$24.99","1"
"Nov 20, 2026","Middle - Auto","Auto","*","-","b0abcdefgh","120","2","$1.60","$24.99","1"
"Nov 20, 2026","Middle - Exact","Exact","ssat vocabulary","EXACT","ssat vocabulary","500","6","$4.20","$24.99","1"`;

describe("Amazon Ads search term report", () => {
  it("parses a report with a metadata line, BOM, quotes, currency and 14-day columns", () => {
    const rows = parseSearchTermReport(CSV);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ campaign: "Middle - Auto", searchTerm: "ssat middle level vocabulary", clicks: 14, spend: 9.8, sales: 49.98, orders: 2 });
  });

  it("suggests negatives, bid cuts, exact harvests and product targets, never actions", () => {
    const s = suggest(parseSearchTermReport(CSV), { breakEvenAcos: 0.246 });
    const kinds = s.map((x) => `${x.kind}:${x.searchTerm}`);
    expect(kinds).toContain("add_negative:vocabulary workbook grade 2");
    expect(kinds).toContain("lower_bid:isee upper level vocabulary book");         // 8.10 / 24.99 = 32% > 24.6%
    expect(kinds).toContain("harvest_exact:ssat middle level vocabulary");          // combined across days: 2 orders
    expect(kinds).toContain("product_target:b0abcdefgh");
    expect(kinds.some((k) => k.endsWith(":ssat vocabulary") && k.startsWith("harvest"))).toBe(false);   // already exact
    expect(s[0].kind).toBe("add_negative");
  });

  it("explains a report without a search term column", () => {
    expect(() => parseSearchTermReport("Campaign,Clicks\nA,1")).toThrow(/Customer Search Term/);
  });
});
