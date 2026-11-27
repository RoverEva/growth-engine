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
| Site checks | Playwright + Lighthouse against the live sites (read-only, never pays): `.github/workflows/site-checks.yml` | Working (daily; checkout-page step is a placeholder) |
| Social | Buffer GraphQL API (`src/lib/social/buffer.ts`); Postiz public API as the open-source alternative (`postiz.ts`) | Built; untested against a real Buffer account until the owner adds the key |
| Connection check | `scripts/check-connections.mjs` (weekly workflow): tests each credential and that a project's GitHub token can't write to another project's repo | Working |
| Background jobs | GitHub Actions schedules (Trigger.dev deferred: not needed yet) | Planned |

## Isolation (multi-project step 2)

- **Manifest is the source of truth.** `src/lib/projects/registry.ts` imports every `projects/<slug>/PROJECT.json`.
  Publishing reads the repo, branch, folder, branch prefix (`growth/<slug>/`) and timezone from it, and
  `assertPublishTarget()` refuses any other repo or a project whose publishing is off. A project can only be created in
  the engine from a manifest. (This replaces the planned `publishing_targets` table: one fewer place to keep in sync.)
- **Database rules:** `projects.slug` is unique; a GitHub repo can belong to one project
  (`projects_github_repo_unique`); a social channel can belong to one project (`social_channels_provider_external_key`);
  a post can only use a channel of its own project (composite foreign key). RLS keeps every row inside its project.
- **Credentials:** project secrets are `NAME__<SLUG>` and are never read for another project or from an unscoped
  fallback. The only shared keys are account-level ones (Supabase, the GSC service account, Buffer's single free-plan
  key); Buffer posting is still limited to channels linked to the post's project.
- **Approval:** articles (`enforce_article_workflow`) and social posts (`enforce_social_post_workflow`) can only be
  approved by a project owner, and only approved items can be published or sent. `/queue` lists everything waiting
  across the brands a user belongs to; each action runs in its own project with that project's role.

## Knowledge base

- **Database:** structured, editable data (products, prices, competitors, keywords, articles).
- **Repo files:** `projects/<slug>/` holds reviewed snapshots that any new session reads first. Once the knowledge
  review screen exists, approving changes in the app opens a PR that updates these files.

## Origin

Built as `seo-engine/` in RoverEva/hatchelite (PR #7, closed unmerged) and moved here with its history on 2026-11-27.
