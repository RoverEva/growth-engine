# Architecture

_Last updated: 2026-11-27_

## Overview

- **App:** Next.js (App Router) + TypeScript + Tailwind, at the repo root. Every page is dynamic and needs sign-in.
- **Database and auth:** Supabase Postgres + Supabase Auth. Every table has `project_id`; row-level security (RLS)
  allows access only to members of that project (roles: owner / editor / viewer). Migrations: `supabase/migrations/`.
- **Server-only integrations:** `src/lib/integrations/`. Keys are read in `src/lib/env.ts`; no `NEXT_PUBLIC_` variables.
- **Writes and external calls:** server actions in `src/app/actions/`, each logged in `automation_runs` with retries
  for temporary errors (`src/lib/runs.ts`, `src/lib/retry.ts`) and in-flight duplicate protection.
- **Approval gate:** database trigger `enforce_article_workflow`: draft → in_review (score ≥ minimum) → approved
  (owner) → pr_open (owner publishes) → published (after the PR is merged).

## Adapters (how the engine reaches the outside world)

| Kind | Adapter | Status |
| --- | --- | --- |
| Publishing | `github-markdown`: PR adds `<content_path>/<slug>.md` in the site's repo (HatchElite format) | Working (Phase 1) |
| Publishing | `github-static-html`: PR adds an HTML post + blog index + sitemap (EVA) | Planned; built after EVA's production cut-over |
| Keyword data | DataForSEO Labs Keyword Ideas | Working |
| Crawling | Built-in crawler (robots.txt, sitemap, navigation, up to ~200 pages) | Planned (multi-project step 3) |
| Crawling | Self-hosted Firecrawl (`FIRECRAWL_URL`), optional | Planned |
| Extraction / writing | Local Ollama (default) or OpenAI | Planned |
| Analytics | Google Search Console (SEO); PostHog Cloud free plan (conversion funnels, payment events); Stripe restricted read-only keys | Planned (see `docs/TOOL_STACK.md`) |
| Site checks | Playwright + Lighthouse against the live sites (read-only, never pays) | Planned |
| Background jobs | GitHub Actions schedules (Trigger.dev deferred: not needed yet) | Planned |

Publishing currently reads the repo, branch and folder from the `projects` row. Multi-project step 2 moves these to a
`publishing_targets` table with a cross-project uniqueness rule (see `docs/decisions/0002-multi-project.md`).

## Knowledge base

- **Database:** structured, editable data (products, prices, competitors, keywords, articles).
- **Repo files:** `projects/<slug>/` holds reviewed snapshots that any new session reads first. Once the knowledge
  review screen exists, approving changes in the app opens a PR that updates these files.

## Origin

Built as `seo-engine/` in RoverEva/hatchelite (PR #7, closed unmerged) and moved here with its history on 2026-11-27.
