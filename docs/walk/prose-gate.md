# The prose check, measured

Rewritten by `npm run eval:content -- --prose` (SPEC §7, issue 1390). Every count is the product's own `proseScore`; the last column is `proseFaults` against `PROSE` in `src/lib/config/constants.ts`. Nothing is spent.

The thresholds: more than 7 joining dashes per 1,000 words (and 4 or more); a sentence said three times; a run of 7 words said 3 times, or of 4 said 6 times; a label 3 items of one list turn on; a sentence spread under 0.3 over 20 sentences or more; one construction used 3 times, or 7 tell phrases together.

**Measured and not made a threshold** (2026-10-10, the same pages). Groups of three: people's pages ran 1.8 to 15.2 per 1,000 words, the stored pages 0 to 12, so a count would stop people first. Wordy phrases (`retext-simplify`): people 0 to 33 per 1,000, stored pages 0 to 6; weak and hedging words (`retext-intensify`): 61 to 126 against 34 to 104; hard sentences (`retext-readability`): 0 to 29 against 0 to 6. The stored pages are already plainer than the pages people wrote, so no `retext` plugin was added. Of `slopless`, the orthography, readability and cliché rules flagged people's pages more than ours (1.8 to 25.9 findings per 1,000 words against 0 to 12.6, most of them quotation marks and heading case); the rules kept are the ones in `src/lib/generate/rules/prose-lint.ts`.

## What the three sets come to

| set | pages | stopped by the check |
|---|---|---|
| pages people wrote, dated before 2023 | 7 | 0 of 7 |
| pages people published, undated | 12 | 1 of 12 |
| stored pages, written before the check | 23 | 14 of 23 |
| pages written since | 0 | 0 of 0 |

Lowest · median · nine in ten · highest:

| count | pages people wrote |
|---|---|
| dashes per 1,000 words | 0 · 0 · 4.7 · 6.4 |
| sentence spread | 0.31 · 0.51 · 0.59 · 0.65 |
| most a sentence is said | 0 · 0 · 2 · 2 |
| most a run of words is said | 0 · 0 · 0 · 0 |
| tell phrases | 0 · 1 · 3 · 6 |

| count | stored pages |
|---|---|
| dashes per 1,000 words | 0 · 8.4 · 17.1 · 28.1 |
| sentence spread | 0.39 · 0.57 · 0.64 · 0.85 |
| most a sentence is said | 0 · 2 · 4 · 5 |
| most a run of words is said | 0 · 0 · 3 · 6 |
| tell phrases | 0 · 0 · 3 · 4 |

## Pages people wrote

| page | words | dashes | per 1,000 | sentence spread | sentence said | phrase said | list label | tell phrases | check |
|---|---|---|---|---|---|---|---|---|---|
| austinplumbery.com (2018) 5-signs-of-a-water-leak | 594 | 2 | 3.4 | 0.43 | 0 | 0 | 0 | 1 | passes |
| austinplumbery.com (2018) how-to-prevent-frozen-pipes | 761 | 2 | 2.6 | 0.42 | 2 | 0 | 0 | 0 | passes |
| fletcherelectric.co.uk (2018) electrical-earthing-explained | 455 | 0 | 0 | – | 0 | 0 | 0 | 0 | passes |
| fletcherelectric.co.uk (2018) rcd-protection | 454 | 1 | 2.2 | 0.4 | 0 | 0 | 0 | 0 | passes |
| fletcherelectric.co.uk (2018) what-to-do-in-the-event-of-a-powercut | 1004 | 0 | 0 | 0.45 | 0 | 0 | 0 | 0 | passes |
| fletcherelectric.co.uk (2018) your-fuse-box-consumer-unit | 571 | 0 | 0 | 0.31 | 0 | 0 | 0 | 1 | passes |
| fletcherelectric.co.uk (2018) part-p-electrical-work-and-building-regu | 528 | 0 | 0 | 0.59 | 0 | 0 | 0 | 0 | passes |
| savvycal.com asynchronous-communication | 3129 | 20 | 6.4 | 0.5 | 0 | 0 | 0 | 3 | passes |
| savvycal.com automate-sales-meeting-scheduling | 2008 | 2 | 1 | 0.49 | 0 | 0 | 0 | 2 | passes |
| savvycal.com best-calendar-apps | 1424 | 6 | 4.2 | 0.51 | 0 | 0 | 0 | 6 | passes |
| wesbos.com hacking-smart-photo-frames | 263 | 0 | 0 | – | 0 | 0 | 0 | 0 | passes |
| wesbos.com new-wesbos-website | 1062 | 5 | 4.7 | 0.57 | 0 | 0 | 0 | 1 | passes |
| wesbos.com parity-purchasing-power | 862 | 0 | 0 | 0.65 | 0 | 0 | 0 | 0 | passes |
| wesbos.com transfer-usd-out-of-paypal-without-fees | 1496 | 0 | 0 | 0.55 | 2 | 0 | 0 | 1 | passes |
| clearleft.com design-effectiveness-in-2026 | 197 | 0 | 0 | – | 0 | 0 | 0 | 0 | passes |
| clearleft.com how-ai-is-redefining-the-way-we-find-content | 841 | 2 | 2.4 | 0.44 | 0 | 0 | 0 | 2 | passes |
| clearleft.com how-ai-helped-us-make-sense-of-hundreds-of-components | 709 | 0 | 0 | 0.59 | 0 | 0 | 0 | 3 | tell_phrases |
| alexander.co.uk 31-january-self-assessment-deadline-is-approaching | 934 | 0 | 0 | 0.57 | 0 | 0 | 0 | 0 | passes |
| alexander.co.uk ai-in-accounting | 643 | 2 | 3.1 | 0.57 | 0 | 0 | 0 | 1 | passes |

Not read (no cached copy, or under 150 words of prose): https://pdxsmiledesign.com/the-future-of-dentistry-is-digital-and-for-the-patients-of-pdx-smile-design-the-future-is-here-today/, https://pdxsmiledesign.com/why-invisalign-is-clearly-the-right-choice-compared-to-diy-mail-in-aligners-for-straightening-teeth/, https://pdxsmiledesign.com/why-are-dental-implants-so-expensive-dental-implant-placement-basic-as-a-step-by-step-process/, https://zunicafe.com/cookbook/.

## Stored pages, written before the check

| page | words | dashes | per 1,000 | sentence spread | sentence said | phrase said | list label | tell phrases | check |
|---|---|---|---|---|---|---|---|---|---|
| live: best-answer-engine-optimization-services-for-ai-visibility | 447 | 4 | 8.9 | 0.46 | 4 | 0 | 0 | 0 | dashes, repeated_sentence |
| live: how-to-rank-in-ai-overview | 1291 | 19 | 14.7 | 0.46 | 2 | 4 | 9 | 0 | dashes, repeated_phrase, list_scaffold |
| live: reachkit-vs-aeo-engine | 1283 | 10 | 7.8 | 0.62 | 2 | 3 | 0 | 0 | dashes, repeated_phrase |
| live: tools-to-track-where-ai-sends-potential-customers | 1231 | 18 | 14.6 | 0.57 | 2 | 0 | 0 | 4 | dashes, tell_phrases |
| pipeline-v2: documentation | 959 | 6 | 6.3 | 0.57 | 0 | 0 | 0 | 2 | passes |
| pipeline-v2: how_to | 1433 | 24 | 16.7 | 0.63 | 2 | 6 | 0 | 0 | dashes, repeated_phrase |
| pipeline-v2: insights | 1214 | 13 | 10.7 | 0.62 | 0 | 0 | 0 | 2 | dashes |
| pipeline-v2: listicle | 1433 | 1 | 0.7 | 0.55 | 2 | 0 | 0 | 1 | passes |
| pipeline-v2: qa | 997 | 17 | 17.1 | 0.64 | 2 | 0 | 0 | 0 | dashes |
| pipeline-v2: research | 1181 | 10 | 8.5 | 0.63 | 0 | 0 | 0 | 3 | dashes |
| pipeline-v2: update | 716 | 4 | 5.6 | 0.52 | 4 | 0 | 0 | 3 | repeated_sentence, tell_phrases |
| stored draft 01-290d12ba | 284 | 0 | 0 | 0.85 | 0 | 0 | 0 | 0 | passes |
| stored draft 02-1aa3e4bb | 249 | 7 | 28.1 | – | 0 | 3 | 0 | 0 | dashes, repeated_phrase |
| stored draft 03-1aadd832 | 471 | 3 | 6.4 | 0.39 | 0 | 0 | 0 | 2 | passes |
| stored draft 04-b9de6399 | 356 | 2 | 5.6 | 0.52 | 0 | 0 | 0 | 1 | passes |
| stored draft 05-07ee19c4 | 237 | 2 | 8.4 | – | 0 | 0 | 0 | 0 | passes |
| stored draft 06-4978ae38 | 551 | 2 | 3.6 | 0.62 | 0 | 0 | 0 | 1 | passes |
| stored draft 07-82d6b624 | 183 | 2 | 10.9 | – | 0 | 0 | 0 | 0 | passes |
| stored draft 08-f9d1acd9 | 329 | 8 | 24.3 | 0.51 | 0 | 0 | 0 | 1 | dashes |
| stored draft 09-3e3929f9 | 228 | 1 | 4.4 | – | 2 | 0 | 0 | 0 | passes |
| stored draft 10-c9eaf64f | 323 | 2 | 6.2 | – | 5 | 0 | 0 | 0 | repeated_sentence |
| stored draft 11-4fa9e7cf | 479 | 3 | 6.3 | 0.58 | 3 | 3 | 0 | 0 | repeated_sentence, repeated_phrase |
| stored draft 12-d28e1ac9 | 401 | 4 | 10 | 0.42 | 4 | 0 | 0 | 0 | dashes, repeated_sentence |
