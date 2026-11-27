# Growth Engine

One shared SEO and marketing engine for several independent websites (projects). **Start with `CLAUDE.md`**: project
list, isolation rules, and where each project's knowledge lives (`projects/<slug>/`, `docs/`).

| Project | Website | Status |
| --- | --- | --- |
| HatchElite | https://hatchelite.com | Active; publishes through PRs into `RoverEva/hatchelite` |
| EVA Video Studio | https://evavideostudio.com | Onboarding; publishing off until its blog adapter exists |

The engine never changes a website directly. Publishing opens a pull request in that website's repo; merging and
deploying stay with the owner.

> Multi-project support is being added in steps (see `docs/progress.md`). The Phase 1 features below were built for a
> single project (HatchElite) and still contain HatchElite defaults until multi-project step 2.

## What works today (Phase 1) and what doesn't yet

| Area | Status | Notes |
| --- | --- | --- |
| Sign-in (Supabase Auth) and roles: owner / editor / viewer | **Working** | Enforced in the database with row-level security, not just in the UI |
| Projects, brand profile, members | **Working** | Owners add members by email after the member signs up |
| Keyword research | **Working** with DataForSEO credentials | DataForSEO Labs *Keyword Ideas*: volume, difficulty, CPC, intent. Saved without duplicates |
| Opportunity scoring | **Working** | Deterministic: relevance to HatchElite (45%) + demand (30%) + ease (25%), weighted by intent |
| Article editor (Markdown) and sources | **Working** | All content stays editable until published |
| Quality score 0–100 | **Working, rule-based** | Metadata, structure, length, readability, sources, internal links, stock AI phrases. Hard fails block submission |
| Source checks | **Working** | Each cited URL is fetched; unreachable sources block submission |
| Approval gate | **Working** | Draft → review (score ≥ minimum) → owner approves → owner publishes. Enforced by a database trigger |
| Publishing | **Working** with a GitHub token | Opens a PR adding `src/content/blog/<slug>.md`; the website build creates the page, metadata, structured data and sitemap entry. Live after merge + deploy |
| Scheduled publishing | **Working** (date-based) | The post's date goes in front matter; the blog hides future-dated posts until a deploy on or after that date |
| Run log, retries, duplicate-run protection | **Working** | `automation_runs`: attempts, errors, cost, log; retries temporary errors (429/5xx/network) |
| Dashboard | **Partly working** | Keyword, article and run figures are real. Clicks, impressions, CTR and position show "—" until Search Console is connected (Phase 3) |
| AI research, outlines and drafts (OpenAI) | **Not built (Phase 2)** | The key can be tested on the Integrations page; nothing uses it yet |
| AI fact-checking, search-intent and originality review | **Not built (Phase 2)** | The current score does not verify that claims are true |
| Competitor SERP analysis, topic clusters, cannibalization checks | **Not built (Phase 2)** | Tables exist (`competitors`, `topic_clusters`, `content_briefs`, `internal_links`) |
| Google Search Console sync, decline / low-CTR alerts, refresh recommendations | **Not built (Phase 3)** | Table exists (`search_performance`) |
| Trigger.dev background jobs, OG image generation, quality-gated auto-publish | **Not built (Phase 3)** | Phase 1 runs jobs inside server actions; `auto_publish` stays off |

## Setup

### 1. Supabase

1. Create a Supabase project (or use your existing one).
2. Apply the migrations in `supabase/migrations/` in name order. Either:
   - **Supabase CLI:** `npx supabase login && npx supabase init` (keep the existing migrations), then `npx supabase link --project-ref <ref>` and `npx supabase db push`; or
   - **SQL editor:** paste each file's contents into Supabase → SQL Editor and run them in order.
3. Authentication → URL configuration: set **Site URL** to the app's URL (e.g. `http://localhost:3000`) and add `<APP_URL>/auth/confirm` to the redirect URLs.

### 2. Environment

```bash
cp .env.example .env.local   # fill in the values; see comments in the file
npm ci
npm run dev                  # http://localhost:3000
```

Required for Phase 1: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `GITHUB_TOKEN`.
The GitHub token should be a **fine-grained** token for `RoverEva/hatchelite` only, with **Contents** and **Pull requests** set to *Read and write*.

### 3. First run

1. Open the app, **Create account**, confirm the email, sign in.
2. Create the project (defaults: HatchElite, `https://hatchelite.com`, `RoverEva/hatchelite`). You become its owner.
3. **Integrations** → *Test connection* for DataForSEO and GitHub.
4. **Keywords** → enter seeds (e.g. `isee vocabulary`) → *Research*.
5. *Start article* on a keyword → write → add sources → *Run quality check* → *Submit for review* → *Approve* → *Publish*.
6. Merge the pull request on GitHub and run the website's **Deploy website** workflow.

## How publishing fits the website

```
SEO Engine (approve) ──► GitHub PR: hatchelite-v2-clean/src/content/blog/<slug>.md
                                     │ merge
                                     ▼
            Website CI build: /blog/<slug> page, metadata, BlogPosting schema, sitemap.xml
                                     │ deploy
                                     ▼
                         https://hatchelite.com/blog/<slug>
```

## Security

- API keys are read only on the server (`src/lib/env.ts`). No variable uses the `NEXT_PUBLIC_` prefix, so none can be bundled into browser code.
- Every database query runs as the signed-in user under row-level security (`supabase/migrations/…_init.sql`). The service-role key is not needed in Phase 1.
- The approval gate is a database trigger: only owners can approve, reject or publish, scores below the minimum cannot be submitted, and editing an approved article sends it back to draft.
- Source checks only fetch public `http(s)` URLs (private and local addresses are refused).

## Tests

```bash
npm test                     # unit tests (scoring, DataForSEO parsing, retries, Markdown format)
npm run typecheck && npm run lint && npm run build
# Database tests: real migrations + row-level security on a throwaway Postgres database
TEST_DATABASE_URL=postgres://postgres@localhost:5432/seo_test npm run test:db
```

The HatchElite blog-format contract test uses a pinned copy of HatchElite's loader (`tests/contracts/hatchelite/`).
`tests/db/supabase-shim.sql` creates a minimal `auth` schema so the migrations run on plain Postgres for testing. Never run it against Supabase.

## Project layout

| Path | What it is |
| --- | --- |
| `supabase/migrations/` | Schema, row-level security, approval-gate trigger |
| `src/app/actions/` | Server actions (all writes and external calls) |
| `src/lib/integrations/` | DataForSEO, GitHub and integration status (server only) |
| `src/lib/seo/` | Opportunity score, quality score, source checks |
| `src/lib/content/` | Slugs and the blog Markdown format |
| `src/lib/runs.ts`, `src/lib/retry.ts` | Run logging, retries, duplicate-run protection |

## Credits

Approaches adapted (not copied wholesale) from MIT-licensed projects:
[TheCraigHewitt/seomachine](https://github.com/TheCraigHewitt/seomachine) (DataForSEO handling, content-scoring dimensions and AI-phrase list),
[AgriciDaniel/claude-blog](https://github.com/AgriciDaniel/claude-blog) (100-point quality categories),
[AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (structured-data checks; planned for Phase 2),
[towfiqi/serpbear](https://github.com/towfiqi/serpbear) (Search Console query pattern; planned for Phase 3).
