#!/usr/bin/env node
// Checks every credential the owner has added, per project, without printing any value.
// Also checks isolation: a project's GitHub token must NOT be able to write to another project's repo.
// Usage: node scripts/check-connections.mjs [--report out.md]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../projects/", import.meta.url);
const manifests = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())
  .map((d) => JSON.parse(readFileSync(new URL(`${d.name}/PROJECT.json`, root))));
const suffix = (slug) => slug.toUpperCase().replace(/-/g, "_");
const secret = (name) => process.env[name]?.trim() || "";
const rows = [];
const add = (scope, item, state, detail) => rows.push({ scope, item, state, detail });

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, body };
}
const gh = (token, path) => call(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });

// Shared accounts
for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_DB_URL", "GSC_SERVICE_ACCOUNT_JSON"]) {
  add("shared", name, secret(name) ? "set" : "missing", secret(name) ? "present (not tested here)" : "add as a GitHub secret");
}
if (secret("GSC_SERVICE_ACCOUNT_JSON")) {
  try {
    const sa = JSON.parse(secret("GSC_SERVICE_ACCOUNT_JSON"));
    add("shared", "GSC service account", sa.client_email && sa.private_key ? "ok" : "invalid", sa.client_email ? `email ${sa.client_email}: add it to each Search Console property (Restricted)` : "JSON has no client_email");
  } catch {
    add("shared", "GSC service account", "invalid", "not valid JSON");
  }
}
const bufferShared = secret("BUFFER_API_KEY");
if (bufferShared) {
  const r = await call("https://api.buffer.com", { method: "POST", headers: { Authorization: `Bearer ${bufferShared}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: "query { account { organizations { id } } }" }) });
  add("shared", "BUFFER_API_KEY", r.status === 200 && !r.body?.errors ? "ok" : "failed", r.status === 200 && !r.body?.errors ? `${r.body.data.account.organizations.length} organization(s)` : `HTTP ${r.status}`);
} else add("shared", "BUFFER_API_KEY", "missing", "needed for social posting");

// Per project
for (const m of manifests) {
  const s = suffix(m.slug);
  const token = secret(`GITHUB_TOKEN__${s}`);
  if (!token) add(m.slug, `GITHUB_TOKEN__${s}`, "missing", `fine-grained token for ${m.repository.github} only`);
  else {
    const own = await gh(token, `/repos/${m.repository.github}`);
    add(m.slug, `GITHUB_TOKEN__${s}`, own.status === 200 && own.body?.permissions?.push ? "ok" : "failed",
      own.status === 200 ? (own.body.permissions?.push ? `can open PRs on ${m.repository.github}` : "read-only: needs Contents + Pull requests write") : `HTTP ${own.status} on ${m.repository.github}`);
    for (const other of manifests.filter((o) => o.slug !== m.slug)) {
      const r = await gh(token, `/repos/${other.repository.github}`);
      const leaks = r.status === 200 && r.body?.permissions?.push;
      add(m.slug, `isolation vs ${other.slug}`, leaks ? "FAILED" : "ok", leaks ? `this token can write to ${other.repository.github}: limit it to ${m.repository.github}` : `cannot write to ${other.repository.github}`);
    }
  }
  const stripe = secret(`STRIPE_RESTRICTED_KEY__${s}`);
  if (!stripe) add(m.slug, `STRIPE_RESTRICTED_KEY__${s}`, "missing", "restricted read-only key");
  else if (!stripe.startsWith("rk_")) add(m.slug, `STRIPE_RESTRICTED_KEY__${s}`, "FAILED", "not a restricted key (must start with rk_): replace it");
  else {
    const r = await call("https://api.stripe.com/v1/charges?limit=1", { headers: { Authorization: `Bearer ${stripe}` } });
    add(m.slug, `STRIPE_RESTRICTED_KEY__${s}`, r.status === 200 ? "ok" : "failed", r.status === 200 ? `reads charges (${stripe.startsWith("rk_live_") ? "live" : "test"} mode)` : `HTTP ${r.status}: add Read on Charges`);
  }
  const ph = secret(`POSTHOG_PERSONAL_API_KEY__${s}`);
  if (!ph) add(m.slug, `POSTHOG_PERSONAL_API_KEY__${s}`, "missing", "optional until funnels are built");
  else {
    const r = await call("https://us.posthog.com/api/projects/", { headers: { Authorization: `Bearer ${ph}` } });
    add(m.slug, `POSTHOG_PERSONAL_API_KEY__${s}`, r.status === 200 ? "ok" : "failed", r.status === 200 ? `${r.body?.results?.length ?? 0} project(s) visible: should be exactly 1` : `HTTP ${r.status}`);
  }
}

const report = ["### Connection check", "", "| Scope | Item | State | Detail |", "| --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.scope} | \`${r.item}\` | ${/fail|invalid/i.test(r.state) ? `**${r.state}**` : r.state} | ${r.detail} |`), ""].join("\n");
console.log(report);
const i = process.argv.indexOf("--report");
if (i > 0) writeFileSync(process.argv[i + 1], report);
process.exit(rows.some((r) => /fail|invalid/i.test(r.state)) ? 1 : 0);
