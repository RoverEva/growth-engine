# HatchElite: website architecture

_Verified from `RoverEva/hatchelite` @ `v2-latest` on 2026-11-27._

- **App:** `hatchelite-v2-clean/`, React 18 + Vite single-page app. Public pages (`/`, `/choose-program`, `/pricing`,
  `/support`, `/terms`, `/privacy`, `/referral-policy`, `/blog`, `/blog/<slug>`) are pre-rendered at build time with
  their own title, description, canonical URL and JSON-LD (`scripts/public-metadata-plugin.mjs`). Signed-in areas
  are client-rendered and not indexed.
- **Backend:** Firebase Auth (email/password + Google), Firestore, Cloud Functions (Node 22), Stripe.
- **Hosting:** Firebase Hosting, project `hatchelite-web`, `cleanUrls: true`, SPA fallback `app-shell.html`.
- **Blog:** Markdown files in `src/content/blog/<slug>.md` with front matter (title, description ≤ 160 characters,
  date, author, tags, draft). Drafts and future-dated posts are hidden at build time. Each post gets a static HTML
  page with the article text, `BlogPosting` schema and a sitemap entry with `lastmod`.
- **CI:** `.github/workflows/ci.yml` (build, `validate:search-metadata`, Lighthouse report).
- **Deploy:** `.github/workflows/deploy.yml` (manual, or on merge when `AUTO_DEPLOY=true`; needs the
  `FIREBASE_SERVICE_ACCOUNT` secret and `VITE_FIREBASE_*` variables).
- **Growth Engine adapter:** `github-markdown` (see `PROJECT.json`).
