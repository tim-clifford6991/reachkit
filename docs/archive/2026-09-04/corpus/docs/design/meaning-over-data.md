# Meaning over data — standing law 2 read against the idiom

> **Design-guardian note, 2026-09-03.** A UX audit of every screen in
> `BUILD.md` §4 and of the approved card idiom (`components.md` §7,
> `tokens.md` §9, the sheets and routes under `previews/`) against
> `00-project.md` standing law 2, verbatim:
>
> **"Simplicity is the product.** Zero SEO knowledge required to read any
> screen. Meaning over data: a number that answers no customer question is
> not rendered, even if we hold it."
>
> **Nothing here moves a row, rules a value or redraws a sheet.** A row
> flips on a signature (`components.md` §5) and none is claimed; the six
> `proposed` values of `tokens.md` §9.3 stay `proposed`; every preview is
> untouched, because a redraw goes through `/design`. This file records
> what the law finds and the one order it fixes. The screen-level findings
> live as `REVIEW(...)` lines on the artifacts that own them — REQ-004,
> REQ-006, REQ-008, REQ-041, REQ-043, JN-001, JN-005, BP-018, BP-024,
> BP-025, BP-026, BP-038 — and the five that would change a promise are
> `OWNER-QUESTIONS.md` items 4 to 8.

## 1. The order the law fixes, which no file states

`BUILD.md` §2.4 reads, verbatim: *"Every bar/point is **direct-labelled**
(name + value) — identity is never color-alone."* BP-018 owns that rule and
the closed chart inventory, and states no order between it and standing law
2. Read as a rule about *which measurements must be drawn*, §2.4 licenses
precisely what the law refuses — and three surfaces already sit on that
reading (§3).

A standing law binds every artifact under it, so the order is not a
judgement call:

> **The law decides whether a mark is drawn. §2.4 decides how a drawn mark
> is labelled.**

§2.4 therefore reads *"every mark that is rendered carries its name and its
value"*, never *"every measurement is rendered as a mark"*. Recorded here,
and asked of BP-018 as a `REVIEW(conflict with PROJECT)` line so that it is
stated once in the node that owns both rules rather than rediscovered by
each surface. Nothing in §2.4's CVD work, its two-colour rule or its closed
inventory is disturbed by this: it constrains marks, and the law constrains
which measurements become marks.

## 2. What the idiom gets right, and why it is worth saying

The audit is a finding-hunt, so the compliant half is recorded too — it is
the half a later change is most likely to spend.

| The idiom's rule | What it does for the law |
|---|---|
| **"Anything asking the customer to act is a tinted panel"** — `ActionPanel`, `components.md` §7.1 | It puts a written request where a status number would otherwise go. `Alert` states a fact; a panel asks for a decision. This is meaning-over-data expressed as a component, and it is the idiom's largest single contribution to the law |
| `ActionPanel`'s **`withheld`** state carries a required written account and **has no `cta` member at all** | A disabled control with no explanation is unbuildable. The law's "designed empty states" (§2.5) enforced by the type rather than by review |
| `Btn`'s **three ranks** (§7.2 widening 2) | "One primary action per screen" becomes checkable by looking. A screen whose primary action is legible needs fewer words telling the reader what to do next |
| **`Stat`'s `delta`-XOR-`goal` union**, unchanged by the widening | A bare number is unrepresentable. REQ-041 criterion 4 held structurally, not by inspection |
| `tokens.md` §9.4's refusal to invent the sign-in panel's specimen score | Rule 1.2 applied to a *rendered* number before it existed. The right instinct, one screen earlier than this audit |
| `tokens.md` §9.2 keeping `--r-card` as a **second** variable beside the ruled `--r-box` | Not a law finding, but the same discipline: a drawn value never silently replaces a ruled one |

## 3. Idiom-level findings

Three, and one drift. None is a redraw; each names what breaks.

### 3.1 A tile can carry two denominators, and the contract cannot refuse it

`Stat`'s registered contract (`components.md` §1, §7.2 widening 3) pairs a
headline figure with **either** a delta **or** a goal, and `GoalDots` draws
the goal as filled dots. The Overview AI-answers tile spends both against
**different denominators**: the headline is a count out of twelve tracked
questions, `GoalDots have={2} goal={6}` draws six, and BP-038 decision 5
adds `AiPresenceWindow` — `k` of a four-week window — as a third. BP-038's
own consequence line says the two readings *"are not to be conflated into
one number"*.

A design that must instruct the reader not to conflate two numbers has
already rendered one too many, and the reader it is instructing is the
founder standing law 2 says needs zero SEO knowledge. **The contract is
where this is invisible**: `delta`-XOR-`goal` guarantees a figure is never
bare and says nothing about whether the goal is counted out of the same
denominator as the figure. Nothing in the registry can catch it.

- **What to record, when the shape is ruled:** the widening that admits a
  goal should require it to be *commensurable with the headline* — same
  unit, same denominator — or carry its own label. That is a contract
  change, so it belongs to a `/design` pass, not to this note.
- **Which reading survives is the owner's** — both are numbers a customer
  reads. `OWNER-QUESTIONS.md` item 7; the lines sit on REQ-041 and BP-038.

### 3.2 `Progress` is drawing three numbers the report declines to explain

The free report's header strip renders `BUILD.md` §4.1's *"three driver
mini-bars"* as three `Progress` bars (`previews/app/src/app/walk/report`,
one per `REPORT.drivers` row). REQ-004 criterion 2 requires each driver
named with its own value; REQ-004's non-goals forbid a per-driver
drill-down **and** any on-screen explanation of the formula. So the idiom is
asked to render three named 0–100 factors and forbidden to make any of them
readable — to a stranger, on the first screen they ever see, above the fold.

The same measurement's *meaning* is already on the page, in words and
counts, as §4.1 module 3's three problem cards. `Progress` is doing the
work here not because a bar is the right form but because §2.4 says a
value must be labelled and nothing said the value had to be drawn.

- **The idiom's stake:** the header strip is the one card on the report
  where the law's two limbs bite at once — a stranger reads it first, and
  it is the densest thing on the screen.
- **The promise is REQ-004's**, so the fix is `OWNER-QUESTIONS.md` item 4;
  the lines sit on REQ-004 and BP-024. BP-024's `missing` field already
  proves a per-factor verdict can travel without a per-factor bar.

### 3.3 `RivalSparkline` renders one fact three ways, five times over

Overview box 5 draws, per rival, a `RivalSparkline` with its endpoint and a
delta badge — `BUILD.md` §4.5's series, `78×` and `was 276×` — for up to
five rivals, and closes with `OVERVIEW.rivalsDim`, whose §4.5 wording is
*"Every line pointing down is the gap shrinking."*

That line is doing a **legend's** job. `tokens.md` §6 and `BUILD.md` §2.5
give the dim line to *explanation* — "one short written line, 11–12px,
dim" — and a legend is not an explanation: it is the instruction manual for
a mark that does not read on its own. Fifteen marks answer the one question
REQ-041 criterion 8 promises, and the pair criterion 11 already pins (the
distance with its previous value) keeps that promise whole.

- **Not a redraw, and not this note's call which encoding goes** — REQ-041's
  non-goals put sparkline geometry and label placement with the design
  system, and that decision belongs to a `/design` pass on a sheet. What is
  recorded here is that one of the three is redundant and that the dim line
  is the evidence.
- The line sits on REQ-041 and BP-038.

### 3.4 Drift: the drawn shell renders a count the requirement does not admit

`previews/app/src/mock/data.ts` sets `SHELL.counts.Calendar = 28`, which is
the same fixture's `CALENDAR.filters` **all** count. REQ-040 criterion 2
admits only *"how many are waiting"* on the customer, and BP-037's
interface says so exactly — `waiting: number`, derived as
`count(*) from drafts where state in ('in_review','needs_attention')`. In
this same fixture that is **2** (`Your review 1` + `Needs you 1`), not 28.

Under the law the difference is the whole point: 28 is inventory and 2 is a
call to act. **The blueprint is right and the drawing is stale.** It is
recorded and not corrected here — a preview changes through `/design`, and
a mock number is exactly the kind of thing that must not be edited outside
that gate.

## 4. Screen by screen

What a stranger must already know to read each screen, and what the law
finds. `—` means the audit found nothing.

| §4 screen | A stranger must already know | Fails the law | Simplest form that keeps the promise |
|---|---|---|---|
| **4.1** Free report | what monthly search volume is and whether a figure is large · what "appears in the top ten" means · what Foundations / Answerability / Presence are · how to read a dot matrix | up to **19** `{vol}/mo` figures at full expansion (12 questions + 5 absent + market total + the free page's target); the market-total `{N}/mo`; three driver values; the matrix's per-row `n/{m}` | search text beside every question, volume only where it ranks a choice the reader can act on (the five absent searches, the free page's target); score + band word + one written line naming the weak factor; the problem cards carry the rest |
| **4.2** Giveaway email | as §4.1, for the target search's volume | — (the volume here is the single reason that page is page 1, with no screen to compare it against) | unchanged |
| **4.3** Setup | nothing | — (three decisions, one submit, every value a choice the customer makes) | unchanged |
| **4.4** App shell | nothing | — at the blueprint; the **drawing** renders the all-items count (§3.4) | unchanged; the preview catches up through `/design` |
| **4.5** Overview | what a `78×` gap ratio is · that "AI answers" means two different things on one tile · what a composite 0–100 score is made of | the AI tile's three denominators (§3.1); the gap module's three encodings per rival (§3.3); the score tile answering a question the head line and three concrete tiles already answer | one reading of AI presence; name + distance + previous value per rival; the head line as the verdict, the three measures the customer can act on beneath it |
| **4.6** Calendar | what a winnability band is (named in words, so: nothing) | REQ-043 criterion 10 read per value puts **six** copies of one Monday on one day panel — an ambiguity in the criterion, not a design choice | one dim provenance line, which is §4.6's own word for it |
| **4.7** Settings | nothing | — (REQ-070 criterion 3 is standing law 2 enforced as a requirement; the Billing card stays pending, `components.md` §7.5) | unchanged |

## 5. What this note does not do

- **Moves no row.** Every `components.md` row stands where §5 and §7 leave
  it. `ActionPanel` and the four widenings are still `proposed`.
- **Rules no value.** The six `tokens.md` §9.3 values are still `proposed`,
  including the two the owner explicitly did not rule.
- **Redraws no preview.** Four sheets, five walkthroughs, `/variants`,
  `/directions` and the four `/idiom` routes are untouched. §3.4's drift is
  reported, not fixed.
- **Changes no criterion.** Fifteen `REVIEW(...)` lines were added across
  twelve artifacts and no criterion, step, decision or interface was edited.
- **Answers none of the five owner questions** it raises
  (`OWNER-QUESTIONS.md` items 4 to 8). Each is a number a customer reads,
  which §1 of the constitution puts with the owner.
