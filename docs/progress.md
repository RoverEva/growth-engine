# Progress

_Last updated: 2026-11-27._ Plan: "Growth Engine: Multi-Project Gap Report & Plan" (owner's Claude doc,
https://claude.ai/artifact/PADtY7AmhebTpe8AiyE871).

## Done
- **Phase 1 (single project):** schema + RLS + roles, Supabase Auth, DataForSEO keyword research, article editor,
  rule-based quality score, source checks, approval gate, GitHub PR publishing, run log. 24 tests.
  _Not yet run against a live Supabase project: needs the owner's Supabase keys._
- **Multi-project step 1:** moved to this repo with history; knowledge base files (`projects/`, `docs/`); CI.

## Next
2. **Multi-project foundation:** additive migration (publishing_targets, products, audiences, knowledge_entries,
   crawl tables, outreach, strategy, GSC, conversions, project_credentials); remove hardcoded HatchElite defaults; header
   project switcher; per-project relevance terms; cross-publishing safeguards; isolation tests.
3. **Website onboarding:** built-in crawler, optional Firecrawl, read-only repo inspector, Ollama extraction, competitor
   discovery, review screen. Validate on hatchelite.com.
4. **Add EVA Video Studio:** onboarding, owner review, EVA-only GitHub token; research and strategy only.
5. **EVA publishing adapter:** after the cut-over and a blog design approved by the owner.

Then **Phase 2** (AI drafting and fact-checks, per project) and **Phase 3** (Search Console, analytics, Trigger.dev).

## Waiting on the owner
- Supabase project URL + anon key; apply `supabase/migrations/`.
- DataForSEO login + API password.
- GitHub fine-grained tokens, one per website repo (Contents + Pull requests: read/write).
- Ollama installed on the Mac (before step 3).
