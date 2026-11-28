# Account Registry

Status of every account and credential the Growth Engine uses. **No secret values live here**: only where each one is
stored, what it can do, when it was last tested and when it expires. Secrets stay outside every repository (macOS
Keychain, `~/.growth-engine/credentials/`, or GitHub Actions secrets). The `/setup` page shows the same status live.

_Last updated: 2026-11-27._

| Account / credential | Brand | Stored in | Engine variable | Access | Status | Expires |
| --- | --- | --- | --- | --- | --- | --- |
| Google service account `growth-engine-seo@growth-engine-516022.iam.gserviceaccount.com`, key `053c5255…` | both | `~/.growth-engine/credentials/google-search-console.json` (dir 700, file 600) | `GSC_SERVICE_ACCOUNT_JSON` (loaded by Start Growth Engine) | Search Console read-only (`webmasters.readonly`) | **Connected**, tested 2026-11-27 | none (rotate yearly) |
| Search Console `sc-domain:hatchelite.com` | HatchElite | Google | n/a | Restricted user | **Connected**; sitemap submitted | n/a |
| Search Console `sc-domain:evavideostudio.com` | EVA | Google | n/a | Restricted user | **Connected**; sitemap not submitted yet | n/a |
| GitHub fine-grained token, `RoverEva/hatchelite` only | HatchElite | Keychain `growth-engine.GITHUB_TOKEN__HATCHELITE` | `GITHUB_TOKEN__HATCHELITE` | Contents + Pull requests write | Waiting for Connect GitHub Tokens | (from the test) |
| GitHub fine-grained token, `RoverEva/Eva-Video-Studio` only | EVA | Keychain `growth-engine.GITHUB_TOKEN__EVA_VIDEO_STUDIO` | `GITHUB_TOKEN__EVA_VIDEO_STUDIO` | Contents + Pull requests write | Waiting for Connect GitHub Tokens | (from the test) |
| Buffer API key (one per account, free plan) | both, per-channel mapping | Keychain `growth-engine.BUFFER_API_KEY` | `BUFFER_API_KEY` | Post to linked channels | Not created yet | n/a |
| PostHog project `hatchelite.com` (own organization) | HatchElite | public `phc_` key in site build | `VITE_POSTHOG_KEY` (repo variable) | Event capture | Not created yet | n/a |
| PostHog project `evavideostudio.com` (own organization) | EVA | public `phc_` key in `site/analytics-config.js` | `EVA_POSTHOG_KEY` | Event capture (cookieless) | Not created yet | n/a |
| Supabase project `growth-engine` | engine | `~/Documents/growth-engine/.env.local` (600) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` | Engine database | Not created yet | n/a |
| Stripe restricted keys (read-only) | per brand | Keychain (planned) | `STRIPE_RESTRICTED_KEY__<SLUG>` | Read charges, sessions, subscriptions | Not created yet | n/a |
| DataForSEO | both | n/a | `DATAFORSEO_*` | Keyword volumes | **Off** (paid; deferred by owner) | n/a |

## Retired credentials
- Google key `c8754d70…`: no longer active at Google (Invalid JWT Signature on 2026-11-27); local file replaced.
  Two other keys exist on the same service account (`3b00fd41…`, `cb6dd45f…`): check their "last used" in Google
  Cloud before deleting either.

## Local jobs (owner's Mac, free)
- `com.growthengine.seo-daily` (6:40 AM daily): Search Console + live sitemap/robots snapshot per brand into
  `~/Documents/growth-engine-status/seo/<brand>/`. Installed by **Set Up Daily SEO** on the Desktop.
