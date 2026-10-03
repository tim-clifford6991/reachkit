# The hard rules, reviewed

Written by `node scripts/eval-content.mjs --rules` on 2026-10-03 (issue 1187; owner ruling D27, SPEC §7 2026-10-02). A tool, not a gate. Nothing was spent: the rules are code, run again over stored text.

**What was measured.** 12 stored drafts (every draft the product has written, all for reachkit.app, read on 2026-10-03), 10 evaluation drafts (the pages #1153 kept under `docs/walk/ab-reachkit/`), and every block of the evaluation set's own pages across 6 sites. *Before* is `main` on 2026-10-03, before this issue changed a rule.

**How a false positive is counted.** A rule that fires is read against the page. It is a violation where the page does what the rule exists to stop, and a false positive otherwise; each reading and its reason is in `scripts/eval-content/stored-drafts/verdicts.json`. A fire nobody has read counts as a false positive. The rate is false positives over all pages in the set.

**Result.** After the change no rule fires wrongly on any of the 22 pages. Pages no deterministic rule stops: stored 4 of 12 before, 11 after; evaluation 0 of 10 before, 4 after. Since #1136 the five stored adverts are no longer a deterministic rule's to stop: `honest_row` stops the one that ranks the business in its title, and the fit check — a model call, not re-run here — stopped four of the five on 2026-10-03 (`fit_claim`, below).

## Each rule: what it guards, and how often it was wrong

| Rule | Guards | Stored drafts: fired · false, before | after | Evaluation drafts: fired · false, before | after | False-positive rate after, all 22 | Decision |
|---|---|---|---|---|---|---|---|
| `grounding` | Invented facts: the page stands on at least one passage that is word for word on the customer's own page. | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Kept, unchanged. |
| `rival_source` | Invented facts: a figure about a named rival with no link beside it. | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Kept, unchanged. Never fired on stored text; its year and label matching are #1135's. |
| `no_invented_people` | Invented people: a quoted remark attributed to someone who is not the customer, with no link. | 0 · 0 (0%) | 0 · 0 (0%) | 1 · 1 (10%) | 0 · 0 (0%) | 0% | Narrowed. A dash counts as an attribution only after the closing quotation mark or closing the block; "its data source — DataForSEO, for instance" is punctuation. |
| `no_unsourced_testimonial` | Invented reviews: what customers are said to say, a rating or a recommendation, or a block quote, with no link. | 2 · 2 (17%) | 0 · 0 (0%) | 6 · 3 (30%) | 3 · 0 (0%) | 0% | Narrowed. The bare words (review, testimonial, endorsement, our customers) are gone; each pattern is now a claim. The unlinked block quote stays. |
| `honest_row` | A false claim about the business: on a market comparison, the business is missing from the comparison table, or the page ranks it "#1" or the best by its own word (SPEC §7, D20). | 0 · 0 (0%) | 1 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Added by #1136 in place of `brand_gap` and `page_frame`. It reads a table that names a rival, and a rank the page gives the business by its own word. |
| `no_hidden_text` | Unsafe markup: text handed to the destination that no reader sees. | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Kept, unchanged. |
| `no_machine_address` | Unsafe markup: a sentence addressed to an assistant, a crawler or a ranking system. | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Kept, unchanged. |
| `near_duplicate` | Structure: the page is not a repeat of one the site already has. | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Kept, unchanged. |
| `no_invented_test` | Invented facts: a test nobody ran. | 0 · 0 (0%) | 0 · 0 (0%) | 2 · 2 (20%) | 0 · 0 (0%) | 0% | Narrowed. A cited page's title inside a link is that page's claim, not ours, and "hands-on" alone is an adjective. |
| `no_invented_provenance` | Invented facts: a case study the page was never given. (A byline and the page's dates are the page's own since #1137.) | 0 · 0 (0%) | 0 · 0 (0%) | 2 · 2 (20%) | 0 · 0 (0%) | 0% | Narrowed. A case study has to be claimed or offered as evidence; "look for case studies on the vendor's site" claims none. Before #1137 took bylines and dates out of this rule, it also stopped "written by a person" and "published on your domain". |
| `no_new_question_heading` | Structure: the page keeps the outline's sections; the answerability pass adds none. | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Kept, unchanged. Not re-measurable: no stored draft keeps its outline. It is not among the stop reasons of any of the 12 stored drafts or the 18 recorded evaluation runs (`content-eval.md`, `content-repair.md`). |
| `traceable_numerals` | Invented figures: a number of 10 or more that no handed fact, no target search and no link carries. | 0 · 0 (0%) | 0 · 0 (0%) | 7 · 6 (60%) | 1 · 0 (0%) | 0% | Narrowed. A figure the page cites beside a link may be repeated without one; a year is not a number (SPEC §7, 2026-09-29); digits glued to a letter are a name, not a figure; and a link is no longer cut in two at a full stop inside its label. Now also the one rule for a figure only ReachKit measured. |
| `first_block_answers` | Structure: the page opens with an answer — a short-answer box of 40–60 words (#1137), or with no box a paragraph inside 320 characters or 60 words. | 1 · 1 (8%) | 0 · 0 (0%) | 8 · 2 (20%) | 6 · 0 (0%) | 0% | Narrowed. With no box, an opening inside 60 words passes even past 320 characters. An opening past both is still stopped, and #1178 splits it in code. |
| `required_blocks` | Structure: the blocks every generated page carries (SPEC §7, 2026-09-29). | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0 · 0 (0%) | 0% | Added by #1137 while this review was open. It asks nothing of a page that was not handed its block inputs, so no stored page can fire it; not measured here. |
| `fit_claim` | A false claim about the business: a use, an audience or a category the knowledge base does not support. | not re-run: it is a model call | — | not re-run | — | — | Added by #1136. A model's judgement of the sentences that name the business; not re-run here. Run once on the twelve stored drafts on 2026-10-03 (1.6¢): it stopped four of the five adverts (02, 08, 09, 10) and none of the other seven. 01, a brochure that claims no category, passes: favourable framing is allowed (D20). |
| `do_not_claim` | False claims about the business: anything on the customer's never-claim list. | not re-run: it is a model call | — | not re-run | — | — | Kept, unchanged. |
| `brand_gap` | An advert posing as an answer: the page names the business before it has answered. | 5 · 1 (8%) | removed | 3 · 3 (30%) | removed | — | Narrowed from a 300-character window to the first sentence and the headings above it, and it decides nothing where the target search names the business. Retires with `page_frame` when #1136 ships honesty by page type. Retired by #1136. |
| `page_frame` | An advert posing as an answer: on a market question, the business is the page's subject. | 4 · 2 (17%) | removed | 7 · 7 (70%) | removed | — | Narrowed to the title, or half or more of the headings. The count of mentions was a style check and is removed; one heading naming the business is the section SPEC §7 requires. Retired by #1136: how the business appears now follows the page's type. |
| `no_private_figure` | Meant: a figure only ReachKit measured, stated with no source. Did: failed any number that also appears anywhere in the stored report. | 6 · 6 (50%) | removed | 8 · 8 (80%) | removed | — | Removed. Every fire was a coincidence (24-hour, 12 questions, 40% more). A measured figure no source states is a number no fact holds, which `traceable_numerals` stops. |

## Page by page

| Page | Target search | Recorded by the product | Before | After | Reading of what still fires |
|---|---|---|---|---|---|
| reachkit.app/01-290d12ba.md | best seo software | no_private_figure, no_unsourced_testimonial, brand_gap | no_private_figure, no_unsourced_testimonial, brand_gap, page_frame | passes |  |
| reachkit.app/02-1aa3e4bb.md | best ai seo software | no_private_figure, brand_gap | no_private_figure, brand_gap, page_frame | honest_row | `honest_row`: violation — Its title is "Best AI SEO Software: ReachKit Writes Your Way to Discovery": the page ranks the business best by its own word. |
| reachkit.app/03-1aadd832.md | best seo software review | passed | passes | passes |  |
| reachkit.app/04-b9de6399.md | what is the best seo software | passed | passes | passes |  |
| reachkit.app/05-07ee19c4.md | seo ai software | no_private_figure, no_unsourced_testimonial, page_frame | no_private_figure, no_unsourced_testimonial, page_frame | passes |  |
| reachkit.app/06-4978ae38.md | best free software for seo | passed | passes | passes |  |
| reachkit.app/07-82d6b624.md | seo software pricing | page_frame | page_frame | passes |  |
| reachkit.app/08-f9d1acd9.md | best local seo software | brand_gap | brand_gap | passes |  |
| reachkit.app/09-3e3929f9.md | best seo software review | no_private_figure, brand_gap | no_private_figure, brand_gap | passes |  |
| reachkit.app/10-c9eaf64f.md | best free software for seo | no_private_figure, brand_gap | no_private_figure, brand_gap | passes |  |
| reachkit.app/11-4fa9e7cf.md | seo content writing software | no_private_figure, first_block_answers | no_private_figure, first_block_answers | passes |  |
| reachkit.app/12-d28e1ac9.md | best answer engine optimization services for ai visibility | passed | passes | passes |  |
| ab-reachkit/A1.md | best ai seo software | — | no_private_figure | passes |  |
| ab-reachkit/A2.md | best seo software review | — | no_unsourced_testimonial | passes |  |
| ab-reachkit/A3.md | what is the best seo software | — | first_block_answers | first_block_answers | `first_block_answers`: violation — The opening is six sentences and 69 words. Mechanical: #1178 splits it in code. |
| ab-reachkit/B1-before-critic.md | best ai seo software | — | no_private_figure, no_invented_people, no_unsourced_testimonial, brand_gap, page_frame, no_invented_test, traceable_numerals, first_block_answers | no_unsourced_testimonial, traceable_numerals, first_block_answers | `no_unsourced_testimonial`: violation — "One OneLittleWeb reviewer says they…" — a quoted remark with no link in its block.<br>`traceable_numerals`: violation — A quoted "76%" and "1,900%" stand with no link beside them anywhere on the page.<br>`first_block_answers`: violation — The answer box is 62 words against SPEC §7's 40–60, as #1153 found. Mechanical: #1178 splits it in code. |
| ab-reachkit/B1.md | best ai seo software | — | no_private_figure, no_unsourced_testimonial, page_frame, no_invented_test, traceable_numerals, first_block_answers | first_block_answers | `first_block_answers`: violation — The answer box is 71 words against SPEC §7's 40–60, as #1153 found. Mechanical: #1178 splits it in code. |
| ab-reachkit/B2-before-critic.md | what is the best seo software | — | no_private_figure, brand_gap, page_frame, traceable_numerals, first_block_answers | passes |  |
| ab-reachkit/B2.md | what is the best seo software | — | no_private_figure, brand_gap, page_frame, traceable_numerals, first_block_answers | first_block_answers | `first_block_answers`: violation — The answer box is 66 words against SPEC §7's 40–60, as #1153 found. Mechanical: #1178 splits it in code. |
| ab-reachkit/B3-before-critic.md | how to get found by chatgpt and google ai | — | no_private_figure, no_unsourced_testimonial, page_frame, no_invented_provenance, traceable_numerals, first_block_answers | no_unsourced_testimonial, first_block_answers | `no_unsourced_testimonial`: violation — A block quote with no link: SPEC §7 admits a quotation only with its source beside it.<br>`first_block_answers`: violation — The answer box is 62 words against SPEC §7's 40–60, as #1153 found. Mechanical: #1178 splits it in code. |
| ab-reachkit/B3.md | how to get found by chatgpt and google ai | — | no_private_figure, no_unsourced_testimonial, page_frame, traceable_numerals, first_block_answers | no_unsourced_testimonial, first_block_answers | `no_unsourced_testimonial`: violation — A block quote with no link: SPEC §7 admits a quotation only with its source beside it.<br>`first_block_answers`: violation — The answer box is 71 words against SPEC §7's 40–60, as #1153 found. Mechanical: #1178 splits it in code. |
| ab-reachkit/C-reference.md | why does chatgpt recommend my competitors | — | no_private_figure, no_unsourced_testimonial, page_frame, no_invented_provenance, traceable_numerals, first_block_answers | passes |  |

## The sites' own sentences

Each block of a site's own pages, taken as a page that states it word for word with that block as its fact. A fire here is a rule stopping something the customer's own public page says. Before → after.

| Site | Blocks | `no_private_figure` | `no_invented_people` | `no_unsourced_testimonial` | `no_hidden_text` | `no_machine_address` |
|---|---|---|---|---|---|---|
| reachkit.app | 119 | 13 → 0 | 0 → 0 | 1 → 0 | 0 → 0 | 0 → 0 |
| linear.app | 376 | 41 → 0 | 0 → 0 | 59 → 0 | 0 → 0 | 0 → 0 |
| plausible.io | 2836 | 114 → 0 | 2 → 0 | 54 → 3 | 0 → 0 | 0 → 0 |
| todoist.com | 519 | 14 → 0 | 1 → 0 | 10 → 0 | 0 → 0 | 0 → 0 |
| pipedrive.com | 112 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| crisp.chat | 246 | 11 → 0 | 0 → 0 | 10 → 0 | 0 → 0 | 0 → 0 |

## What this cannot say

- Every draft and every evaluation draft is for reachkit.app. The other five sites are measured on their own pages only, because no draft of theirs was kept; writing new ones is a model call, which D34 keeps out of this issue.
- A draft's outline is not stored, so `no_new_question_heading` could not be re-run on any page, and the evaluation drafts' facts are the snapshot's pages rather than the passages each was handed.
- `near_duplicate` is compared with the stored drafts that passed before it and the site's measured pages, not with the set that stood on the day.
- `do_not_claim` is a model call and reachkit.app's list is empty; it was not re-run.
