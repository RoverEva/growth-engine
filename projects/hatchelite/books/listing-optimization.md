# Amazon listing optimization: SSAT & ISEE Vocabulary Daily Practice (Middle + Upper)

_Draft 2026-11-27 for the owner to review and paste into KDP (Bookshelf → "Edit paperback details"). Facts come
from the books' print-ready covers; anything marked **confirm** is unverified. Changing the title or subtitle of a
live book can need a new edition: only the description, keywords and categories are safe to change in place._

## Rules these drafts follow

- **No other brands or authors** in keywords or description (no Princeton Review, Kaplan, Barron's). KDP removes them
  and can block the listing.
- **No reviews, rankings, quotes or "best-selling" claims**, and no time-limited promotions in the description.
- **No website URLs** in the description or A+ Content (Amazon's content rules). The covers and interior already point
  readers to hatchelite.com; that's where membership sign-ups come from.
- SSAT® and ISEE® are trademarks used descriptively, with the same disclaimer as the covers.
- **Nothing is changed automatically.** These are drafts; the owner pastes what they approve.

## Price and royalty (owner's list price $34.99, 2026-11-27)

ASINs: **Middle Level B0HT4PX3TP**, **Upper Level B0HT33L66S** (owner). Royalty per copy on Amazon.com from
`src/lib/kdp/royalty.ts` (KDP Help formula, 60% rate, black ink, large trim). Page counts are **estimates from the spine
width**: confirm in KDP and the numbers update.

| Book | List price | Printing | Royalty (Amazon.com) | Royalty (Expanded Distribution) | Break-even ACOS |
| --- | --- | --- | --- | --- | --- |
| Middle (~462 pp, est.) | $34.99 | $8.85 | $12.14 | $5.15 | 35% |
| Middle (~462 pp, est.) | $29.99 | $8.85 | $9.14 | $3.15 | 31% |
| Middle (~462 pp, est.) | $24.99 | $8.85 | $6.14 | $1.15 | 25% |
| Upper (~451 pp, est.) | $34.99 | $8.67 | $12.32 | $5.33 | 35% |
| Upper (~451 pp, est.) | $29.99 | $8.67 | $9.32 | $3.33 | 31% |
| Upper (~451 pp, est.) | $24.99 | $8.67 | $6.32 | $1.33 | 25% |

Discounts on paperbacks are done by lowering the list price in KDP; a change can take up to 72 hours to show and
Amazon may also discount on its own (royalty stays based on your list price). Below about $19.99, Expanded
Distribution copies lose money. Break-even ACOS is the share of the price an ad can cost before an ad-driven sale
earns nothing.

## Keyword research (no scraping)

Amazon's autocomplete, search and product pages aren't scraped (Amazon Conditions of Use). Keyword data comes from:

| Source | What it gives | Status |
| --- | --- | --- |
| Amazon Ads **auto campaign** search-term report (owner exports CSV) | The real searches that showed and sold the books | Start a small auto campaign per book; import weekly (engine: `src/lib/kdp/ads-report.ts`) |
| KDP Ads "suggested keywords" in the campaign builder | Amazon's own keyword suggestions | Copy into the keyword list when creating the campaign |
| Google Search Console (hatchelite.com) | What parents search on Google for these topics | Connected; daily snapshots |
| Competitor listings seen as a shopper | Positioning, page counts, prices | Manual notes below |

**Seed keywords** (to validate with the auto-campaign report, not yet backed by volume data):
`ssat vocabulary`, `isee vocabulary`, `ssat middle level`, `ssat upper level`, `isee middle level`, `isee upper level`,
`ssat prep book`, `isee prep book`, `ssat isee vocabulary workbook`, `private school entrance exam`, `analogies practice`,
`synonyms practice middle school`, `sentence completion practice`, `vocabulary workbook grade 6/7/8`,
`high school entrance exam vocabulary`, `vocabulary builder for teens`.

**Competitor positioning** (public listings): J. Stone's *SSAT & ISEE Vocabulary* (cartoons, ~256 pages, list $26.99),
Justin Grosslight's *Vocabulary Workout for the SSAT/ISEE* ($19.99–$24.99), Princeton Review's *1000 Practice Questions
for the Upper Level SSAT and ISEE* (544 pages, $29.99). HatchElite's angle: **daily lesson structure + 3,000+ questions
in all five verbal formats + timed mini-tests + every answer explained**, in one book per level.

## Middle Level

**Title (on cover, keep):** SSAT & ISEE Middle Level Vocabulary
**Subtitle (if not yet live or at next edition):** Daily Practice for Grades 5–8: 1,500+ Words in 77 Lessons, 3,320
Questions with Synonyms, Analogies and Sentence Completions, 8 Timed Mini-Tests and Full Answer Explanations
**Series:** HatchElite SSAT & ISEE Vocabulary (Middle Level = 1, Upper Level = 2), so Amazon links the two books.

**Description** (KDP allows basic HTML: `<b>`, `<i>`, `<ul>`, `<li>`, `<br>`):

```html
<b>Master the words the SSAT® and ISEE® Middle Level actually test, fifteen minutes a day.</b><br><br>
Vocabulary decides more of the Middle Level verbal score than any other skill: synonyms, analogies and sentence completions all depend on knowing the word. This book turns 1,500+ high-value test words into 77 short themed lessons, then drills each lesson in the exact question types students meet on test day.<br><br>
<b>What's inside</b>
<ul>
<li><b>1,500+ words in 77 themed lessons</b>, from describing people to danger and disaster, 20 words per lesson with clear definitions, example sentences, synonyms, antonyms and word families</li>
<li><b>3,320 practice questions</b>: synonyms, analogies, sentence completion, usage and word forms</li>
<li><b>8 timed mini-tests</b> in real SSAT and ISEE format</li>
<li><b>Full answer key with explanations</b>, so students learn from every mistake</li>
<li><b>A–Z index</b> of every word and a simple daily study plan</li>
</ul>
<b>A routine that fits a school week</b><br>
Day 1: learn 20 words. Day 2: synonyms and analogies. Day 3: completion, usage and word forms. Repeat, and the words stick.<br><br>
<b>Who it's for:</b> students in grades 5–8 preparing for the SSAT Middle Level or ISEE Middle Level, and parents and tutors who want a structured plan. Students heading to the Upper Level test can continue with <i>SSAT & ISEE Upper Level Vocabulary Daily Practice</i>.<br><br>
<i>SSAT® is a registered trademark of The Enrollment Management Association. ISEE® is a registered trademark of the Educational Records Bureau. Neither is affiliated with, sponsors, or endorses this book.</i>
```

**7 backend keywords** (KDP allows up to 50 characters per box; don't repeat title words more than needed):

| # | Keyword box | Chars |
| --- | --- | --- |
| 1 | ssat middle level prep book vocabulary workbook | 47 |
| 2 | isee middle level verbal reasoning practice | 43 |
| 3 | private school entrance exam grade 6 7 8 | 40 |
| 4 | analogies synonyms practice for kids | 36 |
| 5 | sentence completion vocabulary builder | 38 |
| 6 | middle school vocabulary words workbook | 39 |
| 7 | test prep study guide 5th 6th 7th grade | 39 |

**Categories** (KDP lets you pick 3; confirm each exists in the current browser): Study Aids > Admissions Tests (or
"Test Preparation"), Juvenile Nonfiction > Study Aids > Test Preparation, Juvenile Nonfiction > Language Arts >
Vocabulary & Spelling.

**Age/grade:** grade 5 to 8, reading age 10–14.

## Upper Level

**Title (on cover, keep):** SSAT & ISEE Upper Level Vocabulary
**Subtitle (if not yet live or at next edition):** Daily Practice for Grades 8–11: 1,500 Words in 75 Lessons, 3,240
Questions with Synonyms, Analogies and Sentence Completions, 8 Timed Mini-Tests and Full Answer Explanations
**Series:** HatchElite SSAT & ISEE Vocabulary (2)

**Description:**

```html
<b>Master the words the SSAT® and ISEE® Upper Level actually test, fifteen minutes a day.</b><br><br>
The Upper Level verbal sections reward precise, advanced vocabulary: words like <i>perspicacious</i>, <i>ephemeral</i> and <i>obstinate</i> show up as synonyms, analogies and sentence completions. This book teaches 1,500 of the most useful test words in 75 short themed lessons and drills each lesson in the exact question types students meet on test day.<br><br>
<b>What's inside</b>
<ul>
<li><b>1,500 words in 75 themed lessons</b>, from courage and fear to law and justice, 20 words per lesson with clear definitions, example sentences, synonyms, antonyms and word families</li>
<li><b>3,240 practice questions</b>: synonyms, analogies, sentence completion, usage and word forms</li>
<li><b>8 timed mini-tests</b> in real SSAT and ISEE format</li>
<li><b>Full answer key with explanations</b>, so students learn from every mistake</li>
<li><b>A–Z index</b> of every word and a simple daily study plan</li>
</ul>
<b>A routine that fits a school week</b><br>
Day 1: learn 20 words. Day 2: synonyms and analogies. Day 3: completion, usage and word forms.<br><br>
<b>Who it's for:</b> students in grades 8–11 preparing for the SSAT Upper Level or ISEE Upper Level, and parents and tutors who want a structured plan. Younger students can start with <i>SSAT & ISEE Middle Level Vocabulary Daily Practice</i>.<br><br>
<i>SSAT® is a registered trademark of The Enrollment Management Association. ISEE® is a registered trademark of the Educational Records Bureau. Neither is affiliated with, sponsors, or endorses this book.</i>
```

**Confirm before using:** "ephemeral" and "obstinate" are examples of Upper Level-style words; replace them with two
words that are actually in the book's word list.

**7 backend keywords:**

| # | Keyword box | Chars |
| --- | --- | --- |
| 1 | ssat upper level prep book vocabulary workbook | 46 |
| 2 | isee upper level verbal reasoning practice | 42 |
| 3 | private high school entrance exam grade 8 9 | 43 |
| 4 | analogies synonyms practice for teens | 37 |
| 5 | sentence completion advanced vocabulary | 39 |
| 6 | high school vocabulary words workbook | 37 |
| 7 | test prep study guide 8th 9th 10th grade | 40 |

**Categories:** same three as Middle Level, plus Young Adult Nonfiction > Study Aids if available. **Age/grade:** grade 8
to 11, reading age 13–17.

## A+ Content drafts (KDP Marketing → A+ Content Manager)

Same structure for both books; images are built from the real covers and real interior pages (the owner supplies the
interior PDF; nothing is invented). No URLs, prices, reviews or "best" claims.

| Module | Content | Image |
| --- | --- | --- |
| 1. Large header image | "Fifteen minutes a day. 1,500 test words. Every answer explained." | Both covers side by side on brand purple, Middle Level dragon and Upper Level dragon (970 × 600) |
| 2. Image + text: "How every lesson works" | 20 words → definitions, examples, synonyms/antonyms → 40 questions | A real lesson spread from the interior |
| 3. Four images + text: "Five question types" | Synonyms · Analogies · Sentence completion · Usage & word forms | Crops of real question pages, one per type |
| 4. Image + text: "8 timed mini-tests" | Real SSAT and ISEE format; answer key with explanations | A real mini-test page and its answer explanation |
| 5. Three images: "A routine that sticks" | Day 1 learn 20 words · Day 2 synonyms & analogies · Day 3 completion, usage, forms | Original graphics (brand colors) |
| 6. Comparison chart | Middle Level (grades 5–8, 77 lessons, 3,320 questions) vs Upper Level (grades 8–11, 75 lessons, 3,240 questions) | Both covers; links between the two Amazon pages |

**Needed from the owner:** the interior PDFs (or 4–6 page PDFs per book) to cut modules 2–4 from.
