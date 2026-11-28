# 0007: Amazon KDP module: report imports, no scraping; open-source tools evaluated

_Date: 2026-11-27. Decided by: owner (no scraping, no paid APIs, no automated spending), Claude (evaluation)._

## Evaluation (cloned and read 2026-11-27; nothing installed or run)

| Project | License | Last commit | How it gets data | Decision |
| --- | --- | --- | --- | --- |
| [rxpelle/kdp-scout](https://github.com/rxpelle/kdp-scout) | MIT | 2026-11-15 | Amazon autocomplete (`completion.amazon.*`), bestseller/movers pages and product pages via HTTP scraping; optional DataForSEO (paid); **imports Amazon Ads search-term CSVs** | Don't install. Reuse the idea of its CSV import + search-term scoring (rewritten in TypeScript, credited). Its scrapers break Amazon's Conditions of Use. |
| [sq5rix/amads](https://github.com/sq5rix/amads) | **None** (all rights reserved) | 2026-03-14 | Autocomplete and search-page scraping; Ads CSV/API import; bid-change rules | Can't reuse code without a license. Its rules (negate non-converting terms, harvest converters) are standard practice; ours are recommendations only, never bid changes. |
| [YoucefSennoun/kdp-copilot](https://github.com/YoucefSennoun/kdp-copilot) | **None** | 2026-09-11 | Chrome extension scraping Amazon pages; sends data to Google Gemini | Rejected: no license, scraping, sends data to a third-party AI API. |
| [Tanner-Eischen/PublishingStrategist](https://github.com/Tanner-Eischen/PublishingStrategist) | MIT | 2026-09-10 | Keepa API (paid), Ubersuggest, Amazon autocomplete | Rejected: paid data sources, scraping, 169 files of infrastructure we don't need. |

## Decision

- **Data comes from the owner's own official reports:** KDP sales/royalty reports, Amazon Ads search-term and
  campaign reports (CSV exports), Author Central. API access (Amazon Ads API, Amazon Attribution) only later, if the
  account is eligible and the owner authorizes it.
- **No scraping** of Amazon pages or autocomplete; no automated bidding, budgets, purchases or reviews.
- Code lives in `src/lib/kdp/` (royalty and printing cost from KDP Help, search-term report import and
  recommendations); book facts in `projects/hatchelite/books/books.json`.
- Amazon link clicks on hatchelite.com are tracked as `amazon_click` events (PostHog), separately from verified sales
  from KDP reports. Amazon Attribution tags only if the account is eligible.
