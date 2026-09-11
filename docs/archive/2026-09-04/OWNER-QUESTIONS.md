# Owner questions and decisions checkpoint

All outstanding items are here and nowhere else. An item with an owner verb
below it has the answer. An item without it is waiting for you.

---

3. **Google's own AI-visibility report — DEFERRED 2026-09-03, not answered.**
   Since 2026-08-31 Search Console reports, for every site worldwide, which of
   its URLs appeared in AI Overviews and AI Mode (impressions by page,
   country, device, date). Should ReachKit ask customers to connect Search
   Console and show Google's observed figure beside its own sampled one, a new
   customer-side dataset outside `BUILD.md` §6.3's closed list? —
   `registry/evidence/RESEARCH-competitor-visibility-measurement.md` §4.

   **Owner's ruling:** "Search Console connection is POSTPONED — not now,"
   reason given verbatim: "we need to get users on app and later start
   reviewing and improving based on feedback." This item is postponed, not
   answered, and is kept open rather than deleted.

---

# Owner questions — UX simplification audit, 2026-09-03

Five questions from the audit of `BUILD.md` §4 and the approved card idiom
against `00-project.md` standing law 2 ("zero SEO knowledge required to read
any screen; meaning over data: a number that answers no customer question is
not rendered, even if we hold it"). Each is here and not derived because each
removes a number a customer reads — §1's rights table puts that with you.
Grounds are the `REVIEW(...)` line on each artifact named, and the
screen-by-screen reading is `sdlc-factory/docs/design/meaning-over-data.md`.
Nothing has been written into a requirement, a criterion or a preview.

4. **The free report's three driver bars — do they stay?** REQ-004 criterion 2
   shows three named 0–100 factors while REQ-004's own non-goals forbid any
   on-screen explanation of them or any drill-down, so a stranger reads three
   numbers we have decided not to let them understand; the same measurement's
   meaning is already on the page as REQ-009's three problem cards. Simplest
   form that keeps the promise: the score and its band word as the verdict,
   plus one written line naming which factor holds the score down. —
   `requirements/REQ-004.md`, `blueprints/BP-024.md`,
   `design/meaning-over-data.md` §3.2.

   **Owner's ruling, 2026-09-03 — AS AUDITED.** The three driver bars are
   removed. The free report's verdict is the score and its band word, plus one
   written line naming the factor holding the score down. Recorded through
   `/decide`; REQ-004 criterion 2 amended by the requirements-analyst, BP-024
   by the architect. Closed.

5. **Per-question monthly search volume on the free report — does it stay?**
   REQ-006 criterion 9 puts up to twelve `{vol}/mo` figures in front of a
   stranger, and REQ-006's non-goals forbid editing, reordering or removing a
   question — so no decision on that page turns on one. The search text beside
   each question, which criterion 9 also requires, is what makes the market
   checkable. Dropping the figure narrows criterion 9 and edits JN-001 step 5's
   wording. — `requirements/REQ-006.md`, `journeys/JN-001.md`.

   **Owner's ruling, 2026-09-03 — AS AUDITED.** The per-question `{vol}/mo`
   figure is removed. Criterion 9 keeps the search text beside each question —
   what makes the market checkable — and drops the volume. Recorded through
   `/decide`; REQ-006 criterion 9 and JN-001 step 5 amended by the
   requirements-analyst. Closed.

6. **The market-total volume footnote — does it stay?** REQ-008 criterion 3's
   `{N}/mo` has no comparator anywhere on the report and no reader action turns
   on it. Its footnote's second half ("you currently appear in {n}") is already
   the customer's own bar restated, which criterion 3's "exactly once" rule
   forbids. Simplest form: neither half. — `requirements/REQ-008.md`,
   `blueprints/BP-026.md` (`PresenceCard.totalMonthlyVolume` is the field it
   travels in).

   **Owner's ruling, 2026-09-03 — AS AUDITED.** The market-total footnote is
   removed, both halves. Recorded through `/decide`; REQ-008 criterion 3
   amended by the requirements-analyst, BP-026 and the
   `PresenceCard.totalMonthlyVolume` field by the architect. Closed.

7. **Overview's AI-answers tile — one reading of AI presence, or two?** The
   tile carries three denominators: a level out of twelve tracked questions,
   `GOAL_VALUES.ai_answers = 6` out of twelve, and `AiPresenceWindow`'s `k` out
   of a four-week window (your ruling, item 2 above). BP-038 decision 5 keeps
   both readings and says outright they "are not to be conflated into one
   number" — which is the tile asking a founder to hold two meanings of "AI
   answers" apart. Which single reading survives, and what goal it carries, is
   yours. — `requirements/REQ-041.md` criteria 4 and 12, `blueprints/BP-038.md`
   decisions 2 and 5, `design/meaning-over-data.md` §3.1.

   **Owner's ruling, 2026-09-03 — ONE READING.** The Overview AI tile shows a
   single reading: the count of weeks the customer was present, named in the
   trailing window. The level-out-of-twelve reading does not survive on this
   tile. Recorded through `/decide`; REQ-041 criteria 4 and 12 amended by the
   requirements-analyst, BP-038 decisions 2 and 5 — and the fate of
   `GOAL_VALUES.ai_answers` under the surviving reading — by the architect.
   Closed; REQ-041's `REVIEW(conflict with BP-038)` line deleted.

8. **Does the composite score keep a tile on Overview?** It sits beside
   searches-appeared-in, AI presence and pages published — three measures the
   customer can act on — while REQ-004's non-goals forbid explaining anywhere
   what the score is made of. On the free report one number for a stranger
   earns its place; on Overview the head line already answers "is it working"
   in words and the three concrete tiles answer it in measurements. Removing a
   customer-visible verdict is a change to what the product promises. —
   `requirements/REQ-041.md`, `journeys/JN-005.md` (its "under two minutes"
   success condition is the measure this fails).

   **Owner's ruling, 2026-09-03 — NO TILE.** The composite score has no tile on
   Overview. Recorded through `/decide`; REQ-041 and JN-005 amended by the
   requirements-analyst. Closed; REQ-041's `REVIEW(conflict with PROJECT)` line
   deleted.

---

# Owner questions — optimisation and efficiency audit, 2026-09-03

One question. The rest of the audit's findings are parameters, budgets and
price-book rows — the system's under rule 1.1 — and are filed as `REVIEW(...)`
lines on BP-005, BP-007, BP-008, BP-009, BP-023, BP-028, BP-050 and ADR-094.
The arithmetic behind this one is
`sdlc-factory/docs/registry/evidence/RESEARCH-cost-envelope.md` §1.

9. **Does a corrected free report still count Google's actual AI answers?**
   Your 2026-09-03 ruling (item 1) was scoped, in your own words, to "the free
   report": it loads asynchronous AI Overviews, and the card counts Google's
   actual AI answers. A **correction** re-runs that report against a corrected
   category, so its twelve queries are new and none can come from cache. The
   two together exceed the 12¢ cap: the scan is 9.0¢ worst case and the
   correction 6.9¢, and REQ-094 criterion 3 puts both inside one ceiling
   ("spends no further scan allowance and opens no second spend ceiling") —
   **15.9¢ against 12¢**. Even with no surcharge charged at all the pair is
   11.1¢ against 12¢, so the correction is tight either way. Nothing overspends
   — BP-007 degrades at the cap — but the correction then stops mid-flight and
   REQ-094 criterion 7's "the correction did not complete" becomes the ordinary
   result for exactly the reports whose market was read wrongly. Three levers,
   and the choice between them is yours because each changes something a
   customer reads:

   - **Pay for it** — raise `CAPS.FREE_C` from 12¢ to ~18¢. The report keeps
     its promise on both passes; the charter's stated free-report envelope
     moves, and worst-case daily exposure at 200 free scans/day goes from
     ~$13/day (`DATA-COSTS.md` §2) to ~$19.
   - **Don't pay on the second pass** — the correction's twelve SERPs set the
     flag `false`. The corrected card then counts only the AI answers Google
     had cached, which is exactly the disclosure you declined for the first
     pass, now applying to the report a reader asked us to fix.
   - **Let it degrade** — no change; the correction stops at the cap and says
     so. Cheapest, and the one that most often fails the reader who noticed we
     had their market wrong.

   No requirement text changes under any of the three;
   `sdlc-factory/docs/decisions/ADR-094.md` and `blueprints/BP-028.md` carry
   the finding, and `CAPS.FREE_C` is a BP-005 pin.

   **Owner's ruling, 2026-09-03 — `CAPS.FREE_C` STAYS 12¢**, lever two of the
   three above ("don't pay on the second pass"), chosen so the correction still
   completes inside the cap. The owner's reason, verbatim:

   > 12c is already at the top end of what im willing to spend therefore would
   > keep the limit here for the current time. this is a lead magnet but I am
   > not yet confident what a user wants from us therefore wasting money on it
   > is a crime.

   Consequence, ruled with it: a correction's twelve SERPs do **not** buy
   asynchronous AI Overviews. The corrected card counts the AI answers Google
   had cached, and its disclosure says so. Recorded through `/decide` on
   ADR-094 and BP-028 decision 4 by the architect, with the disclosure
   criterion on REQ-094 by the requirements-analyst; `CAPS.FREE_C` stands at
   12¢ in BP-005 by ruling, not by omission.

   **Recorded with it, resolved without you.** While recording this the
   architect first read the ledger as charging the correction for the
   asynchronous surcharge it does not buy, which would have put the pair at
   13.5¢ against 12¢ and left your stated reason — that the correction still
   completes — not holding. On re-examination that was a misreading:
   ADR-094 decision 3 charges the surcharge whenever the flag is `true`
   ("unconditionally" there means regardless of the vendor's later refund, not
   regardless of the flag), and a correction sets it `false`. Your reason
   stands on its own terms.

   The re-examination did find a real defect, now fixed under rule 1.1 rather
   than raised to you: `recordFetch` ledgered the surcharge on the *first*
   pass whether or not Google actually served an asynchronous overview, which
   was harmless while the free path had one spender and is not harmless now
   that the correction wants that headroom. ADR-094 decision 3a splits the
   figure into *reserved* before the call and *settled* from the response,
   which the vendor's own documented refund rule makes derivable. The pair now
   settles at 11.1¢ + 0.2¢ per search that carried an overview — inside 12¢
   whenever at most four of the twelve did, and reaching 13.5¢ only if Google
   served one on all twelve. 11.1¢ is the same figure item 9 put in front of
   you above. Two vendor facts nobody has measured yet — how often Google
   serves these overviews, and BP-008's cache hit rate — decide how often the
   residual case bites; both are carried as an `open` `rests-on` row on
   BP-028, and the only lever that would guarantee completion in every case is
   the cap raise you declined for a reason that does not depend on either.
   Closed.
