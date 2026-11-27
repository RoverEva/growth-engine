# Tool stack

_Last updated: 2026-11-27. Owner-approved tool list; costs checked on that date (sources linked). Re-check prices before
any paid step._

**Goal: paying customers for HatchElite and EVA Video Studio.** Every tool below earns its place by helping with
conversion, payment reliability, SEO, publishing, competitor research, backlinks or outreach. Nothing is added just
to have it.

## Rules

- **Check before adding.** Reuse what already runs (both sites' Stripe, Supabase and Playwright tests; HatchElite's
  Lighthouse CI) and call existing APIs instead of rebuilding them.
- **Free first.** Free tiers and self-hosted open source by default. **Any paid service or paid tier needs the
  owner's approval first**, with an estimate.
- **Production changes need approval.** Adding a tracking snippet, a Search Console verification file or a webhook to a
  live site is a production change. It goes in as a pull request in that site's repo and waits for the owner.
- **Separate per project.** Each project has its own PostHog project, Search Console property, Stripe restricted key,
  GitHub token and Firecrawl crawl data. Nothing is shared across HatchElite and EVA except read-only research keys.
- **Privacy:** see "Privacy" below. HatchElite serves children, so it gets the strictest settings.

## What exists today (checked 2026-11-27)

| Item | HatchElite | EVA Video Studio |
| --- | --- | --- |
| Web analytics | **None running.** A `VITE_FIREBASE_MEASUREMENT_ID` setting exists, but the code never starts Google Analytics | **None** |
| Search Console | Unknown (not visible from the repo) | Unknown; no `sitemap.xml` or `robots.txt` in `site/` |
| Stripe | Yes: Cloud Functions (checkout, webhooks, Customer Portal, promotion codes) | Yes: Stripe Checkout through the Modal API |
| Supabase | No (Firebase) | Yes (accounts, credits) |
| Browser tests | Node scripts in `scripts/test-*.mjs` | Playwright suites in `saas/tests/browser_*.py`, staging end-to-end checks |
| Lighthouse | Lighthouse CI in GitHub Actions (report only) | None |
| Firecrawl | **Not found** in the Mac's Documents, Desktop or Downloads folders; the owner says an installation exists. **Needs:** its URL and API key | n/a (shared tool, separate crawl data) |

## Selected tools

| Tool | Used for | Cost | Setup needed |
| --- | --- | --- | --- |
| **PostHog Cloud** (free plan) | Funnels (visit → pricing → sign-up → trial/checkout → paid), retention, payment events, web vitals | **$0.** The free plan includes 1M analytics events and 5K session recordings a month; without a card, usage is capped at the free limits ([pricing](https://posthog.com/pricing)) | One PostHog project per site; owner-approved snippet PR per site; server-side payment events from existing Stripe webhooks |
| **Google Search Console** | Clicks, impressions, CTR, position, indexing | **$0.** The API is free; Search Analytics has load and per-site query limits ([usage limits](https://developers.google.com/webmaster-tools/limits)) | Verify each domain (DNS record = owner action); one service account added as a user to each property; sitemaps submitted |
| **Playwright + Lighthouse** | UX checks, page speed, "can a visitor reach checkout" on the live sites | **$0** (open source; GitHub Actions minutes in the private repo) | Growth Engine workflow with one read-only check per site; never completes a real payment |
| **Firecrawl** (existing self-hosted) | Website onboarding, competitor pages, backlink-target research | **$0** (self-hosted open source; runs on the owner's machine) | `FIRECRAWL_URL` + `FIRECRAWL_API_KEY` of the existing install; reachable from where the engine runs |
| **Claude / Codex** | Research, drafts, outreach drafts, code changes, scheduled routines | Existing subscriptions | Scheduled tasks already run for HatchElite (daily blog PR, weekly outreach) |
| **Supabase** | Growth Engine database and sign-in (existing Phase 1 design) | Existing plan or free tier | One Supabase project for the engine; separate from EVA's own Supabase |
| **Stripe** | Payment data per site (no change to checkout) | $0 for API access | One **restricted, read-only** key per site (charges, checkout sessions, subscriptions, invoices) |
| **Ollama** (local) | In-app fact extraction during onboarding (decision 0003) | $0 | Install on the Mac when onboarding is built |
| **DataForSEO** (optional) | Keyword volume, difficulty, intent; competitor domains | **Paid: needs approval.** $50 minimum top-up; Labs calls cost $0.012 per task + $0.00012 per item ([pricing](https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api)), so about **$0.024 per 100-keyword run** | Only after approval. Until then, keyword ideas come from Search Console queries and Claude research |

**Not selected** (overlap or cost): Google Analytics 4 (PostHog covers it), Hotjar or Clarity (PostHog replay
covers it), paid SEO suites (Semrush/Ahrefs), Trigger.dev (GitHub Actions schedules are enough for now), a separate
email platform (later, when a list exists).

## Privacy

### HatchElite: children are users. Strictest settings.
- PostHog runs **only on public pages and parent account/billing pages**: `/`, `/choose-program`, `/pricing`,
  `/blog/*`, `/auth`, `/billing*`. It is **off** on student areas: `/study*`, `/games*`, `/dragon-studio`,
  `/profile`, `/levels/*`.
- **Session replay: off** at launch. If it's turned on later, use it on public pages only, with all text and inputs
  masked (`maskAllInputs: true`, `maskTextSelector: "*"`). PostHog masks in the browser, so masked data never leaves the
  device ([privacy controls](https://posthog.com/docs/session-replay/privacy)).
- **Autocapture off.** Only named events are sent: `pricing_viewed`, `signup_started`, `signup_completed`,
  `trial_started`, `checkout_started`, `payment_succeeded`, `payment_failed`, `subscription_canceled`.
- **No student data:** no student names, ages, grades, answers, coins or dragon data. People are identified only by
  the parent's Firebase UID (never by email), and only after sign-in. IP capture off.
- The **privacy policy** must mention analytics before launch. That's an owner-approved change to `/privacy`.
  _Not legal advice: have the owner confirm the children's-privacy (COPPA) position._

### EVA Video Studio: customer content stays private.
- PostHog on the marketing pages and the pricing, membership and account flows.
- **Never recorded:** the Studio editor (`studio.html`), uploads, `video.html`, or any page showing a customer's
  video, prompt or file name. Replay off at launch; autocapture off.
- Named events only: `template_viewed`, `studio_opened`, `preview_rendered`, `checkout_started`,
  `credits_purchased`, `membership_purchased`, `payment_failed`.

## Integration roadmap

Ordered by what brings paying customers soonest. Each step is a pull request; anything touching a live site waits for
approval.

| # | Step | Projects | Delivers | Needs from the owner |
| --- | --- | --- | --- | --- |
| 1 | **Search Console** for both domains; submit sitemaps (EVA needs a `sitemap.xml` + `robots.txt` PR first) | Both | Real search queries to write for, indexing errors | Verify domains (DNS); add the service account to each property; approve EVA's sitemap PR |
| 2 | **PostHog conversion funnels:** snippet with the privacy settings above + named events; payment events from existing Stripe webhooks | Both | Where visitors drop off before paying | Create 2 PostHog projects; approve 1 PR per site (+ privacy policy text) |
| 3 | **Payment reliability checks:** daily Playwright run per site (pages load, pricing correct, checkout button reaches Stripe's page) + weekly Lighthouse; alert on failure. Read-only Stripe key feeds failed-payment counts to the engine | Both | Broken checkout found within a day, not from a lost customer | 2 restricted Stripe keys |
| 4 | **Engine multi-project step 2** (already planned): switcher, isolation, PostHog/GSC/Stripe credentials per project | Engine | One dashboard per project: traffic, conversion, payments | Supabase keys for the engine |
| 5 | **Growth dashboard:** GSC daily sync + PostHog funnel + Stripe revenue per project; "high impressions, low CTR" and "declining page" lists | Engine | What to fix or write next, ranked | none |
| 6 | **Firecrawl onboarding + competitor research** | Both | Competitor pages, pricing comparisons, backlink targets | Firecrawl URL/key |
| 7 | **Backlinks + personalized outreach:** prospects from Firecrawl/GSC; Claude drafts personal emails; owner sends | Both | Links and partnerships | Owner sends emails |
| 8 | **DataForSEO** (if approved) | Either | Search volume and difficulty for prioritizing | Cost approval, top-up |

## Per-project credentials (names only; values live in environment variables)

| Service | HatchElite | EVA Video Studio |
| --- | --- | --- |
| PostHog | `POSTHOG_PROJECT_KEY__HATCHELITE` (public snippet key), `POSTHOG_PERSONAL_API_KEY__HATCHELITE` (engine, read) | `…__EVA_VIDEO_STUDIO` |
| Search Console | Property `sc-domain:hatchelite.com`, shared service account `GSC_SERVICE_ACCOUNT_JSON` | `sc-domain:evavideostudio.com` |
| Stripe (read-only) | `STRIPE_RESTRICTED_KEY__HATCHELITE` | `STRIPE_RESTRICTED_KEY__EVA_VIDEO_STUDIO` |
| GitHub (PRs) | `GITHUB_TOKEN__HATCHELITE` (repo `RoverEva/hatchelite` only) | `GITHUB_TOKEN__EVA_VIDEO_STUDIO` (repo `RoverEva/Eva-Video-Studio` only) |
| Firecrawl | `FIRECRAWL_URL`, `FIRECRAWL_API_KEY` (shared tool; crawl results stored per project) | same |
| DataForSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` (shared, if approved) | same |
