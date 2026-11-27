# Growth Engine — start here

One shared SEO and marketing engine for several independent websites. Each website is a **project** with its own
knowledge, data, credentials and publishing method. This file and the files it points to are the source of truth.
Chat history is not.

## Read before working

1. `docs/progress.md`: what is done, in progress and next.
2. `docs/architecture.md`: how the engine is built (Next.js app, Supabase, adapters).
3. `docs/decisions/`: why things are the way they are (one dated file per decision).
4. **Before touching a project:** everything in `projects/<slug>/`, starting with `PROJECT.json`.

| Project | Slug | Website | Status |
| --- | --- | --- | --- |
| HatchElite | `hatchelite` | https://hatchelite.com | Active (first validated project) |
| EVA Video Studio | `eva-video-studio` | https://evavideostudio.com | Onboarding: knowledge base not yet reviewed, publishing off |

## Rules

- **Project isolation.** Never use one project's credentials, repository, keywords, content or contacts for another.
  Never publish one project's content to another project's site or repo. If a task mentions two projects, handle each
  separately and say which one each change belongs to.
- **No live-site changes without the owner's explicit approval.** Publishing means opening a pull request in the
  website's repo. Merging and deploying are the owner's decision. Never deploy, merge, or change DNS, hosting or
  payment settings.
- **Facts need sources.** Product, pricing and audience facts in `projects/*/` must cite where they came from (a URL, a
  file in the site's repo, or the owner). Mark anything unconfirmed as *unverified*.
- **Keep the knowledge base current.** When you learn or change something durable (a decision, a new adapter, a
  changed price), update the matching file in `projects/<slug>/` or `docs/` in the same pull request.
- **Prefer free, open-source, self-hostable tools.** Say clearly what is working and what is a placeholder.
- Secrets live only in environment variables or Supabase Vault, never in this repo.

## Code

The app is at the repo root (Next.js App Router + TypeScript + Supabase). See `README.md` for setup and tests, and
`AGENTS.md`: this Next.js version differs from older ones, so read `node_modules/next/dist/docs/` before changing it.
