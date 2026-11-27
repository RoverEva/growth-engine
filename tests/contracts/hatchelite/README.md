# Pinned contract: HatchElite blog loader

`blog-content.mjs` is a byte-for-byte copy of
`hatchelite-v2-clean/scripts/blog-content.mjs` from **RoverEva/hatchelite @ v2-latest (4e1a4c7, 2026-11-27)**.

The `github-markdown` publishing adapter writes Markdown that this loader must accept.
`tests/unit/content.test.ts` runs the adapter's output through it.

**When HatchElite's blog loader changes**, copy the new file here, update the commit above, and run `npm test`.
