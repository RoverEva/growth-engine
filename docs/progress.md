# Progress

_Last updated: 2026-11-27._ Plan: "Growth Engine: Multi-Project Gap Report & Plan" (owner's Claude doc,
https://claude.ai/artifact/PADtY7AmhebTpe8AiyE871).

## Done
- **Phase 1 (single project):** schema + RLS + roles, Supabase Auth, DataForSEO keyword research, article editor,
  rule-based quality score, source checks, approval gate, GitHub PR publishing, run log. 24 tests.
  _Not yet run against a live Supabase project: needs the owner's Supabase keys._
- **Multi-project step 1:** moved to this repo with history; knowledge base files (`projects/`, `docs/`); CI.
- **Privacy-first analytics PRs (owner to review/merge):** HatchElite PR #9 (PostHog, allowlisted pages and events,
  URLs stripped, never on study pages); EVA PR #18 (cookieless, home/pricing/membership only, DNT/GPC/opt-out). EVA
  sitemap.xml + robots.txt: EVA PR #17.
- **Payment-reliability checks (roadmap item 3, partial):** `.github/workflows/site-checks.yml` runs daily per site
  (`projects/<slug>/site-checks.json`): pages load, prices match `products.md`, HatchElite's trial button leads to
  sign-up. Weekly Lighthouse table in the run summary. Read-only; analytics blocked so checks are not counted.
  _Placeholder:_ reaching Stripe's checkout page needs a signed-in test account on each site (owner to create);
  not built yet. EVA's sitemap/robots checks are optional until PR #17 is live.

- **Multi-project step 2 (built; not yet run against a live Supabase):** migration `20261127000003` (project slug,
  no HatchElite defaults, one repo per project, social channels/posts with owner approval), manifest registry with
  `assertPublishTarget`, per-project secrets `NAME__<SLUG>`, PR branches `growth/<slug>/`, per-project keyword topic
  terms in `PROJECT.json`, top-bar navigation, **/setup** account wizard, **/queue** cross-brand approval queue,
  per-project **Social** page, Buffer adapter + Postiz alternative, `migrate.yml` (manual, dry run by default),
  `connections.yml` (weekly credential + isolation check). 39 tests (17 database).
  _Placeholders:_ Search Console verification status (needs the GSC sync), Buffer field names verified only against
  Buffer's docs until the owner's key is added.

## Next
2. **Multi-project foundation (remaining):** additive migration (publishing_targets, products, audiences, knowledge_entries,
   crawl tables, outreach, strategy, GSC, conversions). Done in step 2: defaults, switcher, relevance terms,
   cross-publishing safeguards, isolation tests.
3. **Website onboarding:** built-in crawler, optional Firecrawl, read-only repo inspector, Ollama extraction, competitor
   discovery, review screen. Validate on hatchelite.com.
4. **Add EVA Video Studio:** onboarding, owner review, EVA-only GitHub token; research and strategy only.
5. **EVA publishing adapter:** after the cut-over and a blog design approved by the owner.

Then **Phase 2** (AI drafting and fact-checks, per project) and **Phase 3** (Search Console, analytics, Trigger.dev).

## Tool stack
Approved 2026-11-27: `docs/TOOL_STACK.md` (PostHog Cloud free, Search Console, Playwright + Lighthouse, existing
Firecrawl, Claude/Codex, Supabase + Stripe; DataForSEO only with cost approval). Its roadmap is ordered by customer
impact: Search Console → PostHog funnels → payment-reliability checks → engine step 2 → dashboard → Firecrawl →
outreach.

## Waiting on the owner
- Merge decisions: growth-engine #1, hatchelite #9, EVA #17 and #18 (EVA #18 also needs the privacy text approved and
  `legal/legal.json` `last_updated` changed).
- Optional: one test parent account per site (no payment card) so the daily check can confirm checkout opens.
- Supabase project URL + anon key; apply `supabase/migrations/`.
- DataForSEO: only if the cost is approved ($50 minimum top-up).
- Firecrawl: URL and API key of the existing self-hosted install (not found in Documents/Desktop/Downloads).
- Search Console domain verification; two PostHog projects; two restricted Stripe keys.
- GitHub fine-grained tokens, one per website repo (Contents + Pull requests: read/write).
- Ollama installed on the Mac (before step 3).
