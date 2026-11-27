# 0003: Website onboarding tools

- **Date:** 2026-11-27
- **Status:** Accepted (owner), implementation pending (multi-project step 3)

## Decision
- **Crawler:** a built-in lightweight crawler by default, plus optional self-hosted **Firecrawl** (AGPL-3.0, Docker
  Compose; the self-hosted build lacks Firecrawl Cloud's anti-bot layer) when `FIRECRAWL_URL` is set. Crawl4AI
  (Apache-2.0) is the fallback alternative.
- **Extraction model:** a local **Ollama** model on the owner's Mac by default (free, private). OpenAI stays optional.
- Onboarding is read-only for websites and repos. Every extracted fact must cite its source page and is reviewed by
  the owner before the project becomes active.
