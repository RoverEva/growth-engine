#!/usr/bin/env node
// Read-only checks of each project's live site: pages load, prices shown match the knowledge base, and the paid
// call-to-action leads to sign-up. Never signs in, never submits forms, never pays.
// Usage: node scripts/site-checks.mjs <slug> [--base-url http://localhost:4173] [--report out.md]
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const slug = args[0];
const opt = (name) => { const i = args.indexOf(name); return i > 0 ? args[i + 1] : undefined; };
if (!slug || !/^[a-z0-9-]+$/.test(slug)) { console.error("usage: site-checks.mjs <slug> [--base-url URL] [--report FILE]"); process.exit(2); }
const config = JSON.parse(readFileSync(new URL(`../projects/${slug}/site-checks.json`, import.meta.url)));
const base = (opt("--base-url") ?? config.baseUrl).replace(/\/$/, "");

const results = [];
const record = (page, ok, detail, optional) => results.push({ page, ok, detail, optional: Boolean(optional) });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const context = await browser.newContext({ userAgent: `GrowthEngineSiteCheck/1.0 (+${slug}; read-only)` });
// Block analytics so checks never count as visitors.
await context.route(/posthog\.com|google-analytics|googletagmanager/, (route) => route.abort());
try {
  for (const p of config.pages) {
    const url = base + p.path;
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      const res = await page.goto(url, { waitUntil: p.raw ? "commit" : "networkidle", timeout: 45000 });
      const status = res?.status() ?? 0;
      const problems = [];
      if (status !== (p.expectStatus ?? 200)) problems.push(`status ${status}`);
      const text = p.raw ? await res.text() : await page.locator("body").innerText();
      for (const t of p.expectText ?? []) if (!text.toLowerCase().includes(t.toLowerCase())) problems.push(`missing "${t}"`);
      if (p.clickText && problems.length === 0) {
        await page.getByText(p.clickText, { exact: false }).first().click();
        await page.waitForLoadState("networkidle");
        const after = new URL(page.url());
        if (!after.pathname.startsWith(p.expectUrlAfterClick)) problems.push(`"${p.clickText}" went to ${after.pathname}, expected ${p.expectUrlAfterClick}`);
      }
      if (errors.length) problems.push(`JS errors: ${errors.slice(0, 2).join(" | ")}`);
      record(p.path, problems.length === 0, problems.join("; ") || `ok (${status})`, p.optional);
    } catch (e) {
      record(p.path, false, String(e.message).split("\n")[0], p.optional);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok && !r.optional);
const lines = [`### ${slug} site checks (${base})`, "", "| Page | Result | Detail |", "| --- | --- | --- |",
  ...results.map((r) => `| \`${r.page}\` | ${r.ok ? "pass" : r.optional ? "skip (optional)" : "**FAIL**"} | ${r.detail.replace(/\|/g, "\\|")} |`), ""];
const report = lines.join("\n");
console.log(report);
if (opt("--report")) writeFileSync(opt("--report"), report);
process.exit(failed.length ? 1 : 0);
