# 0002: Multi-project design

- **Date:** 2026-11-27
- **Status:** Accepted (owner), implementation pending (multi-project step 2)

## Decision
- One engine, one database. All data is isolated by `project_id` and row-level security.
- Hardcoded HatchElite defaults are removed; HatchElite becomes seed data for its own project.
- Each website gets a **publishing target** with an adapter type. A repo + folder can belong to only one project, and an
  article can be published only through a target of its own project.
- Per-project credentials for anything that writes (GitHub tokens limited to one repo) or reads private data (Search
  Console, analytics). Shared keys only for read-only research services (DataForSEO, OpenAI).
- Layered safeguards against cross-publishing: database constraints, repo-limited tokens, adapter checks (repo matches
  `PROJECT.json`, URL host matches the project domain, branch prefix `growth/<slug>/`), and a UI project switcher with
  confirmations that name the project and domain.

Full analysis: "Growth Engine: Multi-Project Gap Report & Plan" (owner's Claude doc, 2026-11-27).
