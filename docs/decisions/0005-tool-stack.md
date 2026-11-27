# 0005: Tool stack for customer acquisition

- **Date:** 2026-11-27
- **Status:** Accepted (owner)

## Decision
PostHog Cloud (free plan) for conversion and payment analytics; Google Search Console for SEO; Playwright + Lighthouse
for live-site UX and checkout checks; the owner's existing self-hosted Firecrawl for crawling; Claude/Codex for
research, content and automation; existing Supabase and Stripe kept as they are. DataForSEO is optional and needs cost
approval. Details, costs, privacy rules and roadmap: `docs/TOOL_STACK.md`.

## Changes to earlier decisions
- **0003:** Firecrawl is the owner's existing installation, so it is used directly (not "optional later"). Ollama stays
  for in-app extraction; Claude/Codex do research and writing through scheduled tasks and PRs.
- **Phase 1 plan:** Trigger.dev deferred; GitHub Actions schedules are enough for now. DataForSEO is no longer
  required for keyword ideas; Search Console queries come first.
