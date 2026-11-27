# EVA Video Studio: website architecture

_Verified from a read-only clone of `RoverEva/Eva-Video-Studio` @ main (4ebe830) on 2026-11-27. Nothing was changed._

- **Website:** `site/`, hand-written static HTML/CSS/JS (no framework): index, templates, pricing, membership,
  studio, video(s), account, legal pages, `config.js`, `i18n.js`. Hosted on **Vercel** (project
  `eva-video-studio`); `site/vercel.json` sets headers and a few rewrites, with `cleanUrls: false`.
- **No blog, no `sitemap.xml`, no `robots.txt`** in `site/`.
- **Backend:** web API (Starlette on Modal), render workers on Modal, Supabase (accounts, credits), Stripe Checkout,
  Cloudflare R2 storage. Its Supabase project is separate from the Growth Engine's.
- **Deploys:** manual GitHub workflows only (`production-*.yml`, `frontend-deploy.yml`), environment
  `production` with a required reviewer and the owner's one-time authenticator code
  (`saas/deploy/approval_gate.py`). They run only from `main` when `EVA_STUDIO_PRODUCTION=enabled`.
  Root `vercel.json` disables Git deployments.
- **Production source today:** still built from `RoverEva/eva-video-style` until the cut-over in `MIGRATION.md`.

## Planned publishing adapter (not built)
`github-static-html`: a PR into `main` adding `site/blog/<slug>.html` from an EVA blog template, updating
`site/blog/index.html` and a new `site/sitemap.xml`, plus `robots.txt`. It needs a blog design approved by the
owner and the cut-over first. Deploys stay on EVA's own owner-approved workflow.
