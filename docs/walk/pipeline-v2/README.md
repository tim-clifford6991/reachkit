# The five-stage pipeline, one page a type — reachkit.app, 2026-10-04

The proof of SPEC §7 D41–D43 (#1252), for the owner's read. Each page was written by
`npm run page -- --site reachkit.app --type <type> --topic "<q>" --out docs/walk/pipeline-v2`,
from the site's production export (`scripts/page/snapshot/reachkit.app.json`). Beside each page is
the context pack it was written from (`<type>.pack.json`) and the run's record (`<type>.run.json`).

**Five of the seven types passed every check on 2026-10-04; current insights passed the same day once it read a news search (#1259). The listicle did not, and is not papered over.**

| Type | Topic | Outcome | Words | Calls | Cost of the kept run |
|---|---|---|---|---|---|
| Documentation | what is the discoverability score | passed, after its one fix call | 864 | write, fix | 12.08¢ |
| How-to | how to get your business named in ai answers | passed, after its one fix call | 1,337 | 2 research, write, fix | 11.48¢ |
| Research | ai answer visibility statistics | passed as written (two figures linked in code) | 1,065 | write | 4.67¢ |
| Q&A | why does chatgpt recommend my competitors | passed as written | 896 | 2 research, write | 5.55¢ |
| Update | the live page *Best answer engine optimization services for AI visibility* | passed as written | 584 | 2 research, write | 5.37¢ |
| Listicle | best ai visibility tools for small businesses | **stopped**: `required_blocks` (table) | 1,314 | 2 research, write, fit, fix, fit | 13.28¢ |
| Current insights | AI discovery monitoring and content news | passed as written, from a news search held to the market (#1259, #1262, below) | 1,030 | 3 news searches, the news judgement, 2 research, write | 8.24¢ |

Every page that was written cost under the 25¢ a page.

## The two that did not pass

**Listicle.** `listicle.md` is the stopped page, kept so it can be read. The pack held both rivals
(aeoengine.ai and meltwater.com, each with claims from its own pages). The writer set the options
across the top of the table; the page pass then took out the rival columns whose cells said a value
was missing (Meltwater publishes no price), which left a table with ReachKit alone, and the
template asks for the customer and two rivals. The fix call did not rebuild the table, and the page
was also 186 words under its 1,500 floor. The pipeline did what D41 says — it stopped the page —
but a comparison in a market where a rival states no price needs either a table built in code from
the pack or a rule the writer follows; that is not solved here. Three earlier attempts at this page
failed on other things that are fixed in this branch (the table's orientation was misread by the
check; the fit check did not know the site's market and stopped a sentence that placed ReachKit in
it; a repair that cleared one check was thrown away because another still failed).

**Current insights — written since, by #1259 (D48).** `insights.md` is the page: the news was searched for the market's category and two synonyms (0.2¢ a search), five results dated inside 30 days were read, and the page was written from three of them — Search Engine Journal (24 September), GlobeNewswire (30 September) and Dynamic Business (2 October) — and passed every check as written. One thing to read it for: the third item, a security vendor's launch, is beside the market rather than in it; a news search matches words, and nothing yet judges whether a result is about this market. What follows is the first attempt, kept as it was written.

**Current insights, held to the market — #1262, 2026-10-05.** `insights.md` is now this run's page. Eight dated results were read and one small call judged each against the site's market (0.34¢). Four were kept and the page is written from those four: FinancialContent (3 October, an AI-visibility audit for online retailers), Markets Insider (23 September, Grid My Business's AI search), Digiday (15 September, measuring a brand's AI visibility) and CMSWire (18 September, owned content and AI mentions). Four were dropped, and `insights.pack.json` lists all eight with the verdict (`news`): the security vendor's launch that #1259's page carried; an error page a publisher served in place of its story; and two a reader might have kept — a benchmark of AI visibility among industrial-automation vendors, and PR Newswire's AEO and GEO report for APAC. The judgement leans strict. The page passed every check as written, at 8.24¢ (two news searches billed, the third returned nothing).

**Current insights, the first attempt.** The one search returned no page whose own markup dates it inside 30 days
(eight results read; the newest was dated 11 August 2026). The page was rightly not written:
`step_failed:pack:recent_results`. An ordinary web search is the wrong source for news; the type
needs a search of the news, which is a vendor endpoint this product does not buy yet.

## What the proof spent

**140.6¢** in all, against the 150¢ allowed — the seven runs kept that morning are 53.9¢ of it (the current-insights row above is #1262's run of 2026-10-05: 8.24¢, which replaced #1259's of 7.73¢ plus 0.4¢ for its cost check, under the owner's exception on that issue). The rest
bought the failures that found defects, each now fixed in code:

| Found by a failed run | Fixed by |
|---|---|
| Links from a quoted fact to the customer's own page were stripped, so the quote read as unsourced | a link to a page one of the pack's facts was read from stands |
| A block quote of a pack passage came back without its link | code gives it the passage's own page |
| Pages came back short or long | the writer is told a word count a section, and the fix call the count against the range |
| A Q&A page's sections were dropped (the writer numbered its keys) | `question_2` fills the `question` slot |
| The stored report held three measured questions | the tracked buyer prompts (D19) are read as measured questions |
| A whole page lost twice because a list came back as JSON text | the text is parsed against the list's own schema |
| A 62-word short answer | an over-long answer is cut after the last sentence that fits |
| A heading written "chatgpt" and "i" | words that own a capital in the page's prose get it back |
| An update stopped for gaining an answer box its live page never had | an update's 20% is counted over the words under its headings |

Round 2 of the content test (#1164) also spent about 129¢ today, so the day's live testing is past
D34's €2.

## What the export holds, and one thing to know

Production's knowledge base for reachkit.app is empty (`site_profiles.knowledge = {}`), so the
export carries round 2's reading of the home and pricing pages (the gallery pages it also read are
taken out, as #1249 now does) and the two founder's answers round 2 used. Until a pass rebuilds the
knowledge base in production, the daily job's packs for this site hold its passages and no
knowledge-base items.
