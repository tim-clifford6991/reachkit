# Evidence — what the `nano` tier can actually be bought at, against BP-005's `INFERENCE_PRICE_BOOK.nano`

Read on **2026-09-04** against `src/lib/llm/tiers.ts`, `src/lib/config/constants.ts`,
BP-005's `## Public interface`, BP-009, `DATA-COSTS.md` §1, and
`registry/evidence/RESEARCH-cost-envelope.md`.

Bears on: BP-005, BP-007, BP-009, BP-011, BP-025; WO-026 (its fifth `rests-on`
row, which this file discharges the *factual* half of and no more).

**This file records a price gap. It does not close it — the closing move is a
price, and a price is the owner's (constitution §1).**

---

## 0. Provenance, stated plainly — read this before quoting anything below

The two vendor rows in §1 come from **the `claude-api` skill's bundled model
table, cached 2026-06-24**, read on **2026-09-04** by the coordinating session
and handed to this architect in the dispatch that produced this file.

**It is a cached table, not a fetch of Anthropic's live pricing page.** No
session in this chain performed a live vendor-catalogue lookup, and this
architect has no browsing tool with which to perform one. No URL is quoted
below, because no URL was accessed — quoting one would be exactly the
"paraphrase presented as a quotation" constitution §8 calls a defect.

**A reader who needs certainty must re-check §1 against Anthropic's published
pricing before acting on it.** Two things in particular could have moved since
the table was cached on 2026-06-24: the per-token prices themselves, and
whether a cheaper model has since been published that the table cannot know
about.

What §1 *is* good enough for: establishing that the pin in §2 was never
derived from an Anthropic price at all — a claim §3 grounds in this corpus's
own documents, which this architect read directly today and which do not
depend on §1 being current.

---

## 1. The two rows, verbatim from that cached table

| Model | Model ID | Input $/1M | Output $/1M |
|---|---|---|---|
| Claude Fable 5 | `claude-fable-5` | $10.00 | $50.00 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1.00 | $5.00 |

Two facts stated about that table, as handed over and recorded as such:

1. **Haiku 4.5 is the cheapest model in it.** Nothing in that table is cheaper.
2. **No row in it prices at 20 ¢ in / 125 ¢ per MTok out.**

Converted to this corpus's own units (US cents per million tokens, the units
`INFERENCE_PRICE_BOOK` is written in — $1.00 per 1M tokens = 100 ¢/MTok):

| Tier row | in ¢/MTok | out ¢/MTok |
|---|---|---|
| `claude-fable-5` | 1000 | 5000 |
| `claude-haiku-4-5` | **100** | **500** |

`INFERENCE_PRICE_BOOK.haiku` (`src/lib/config/constants.ts`, verbatim:
`haiku: Object.freeze({ inCentsPerM: 100, outCentsPerM: 500 })`) **matches the
Haiku 4.5 row exactly.** That pin is not in question and this file does not
disturb it.

---

## 2. The pin that matches nothing in §1

`src/lib/config/constants.ts`, verbatim:

```ts
export const INFERENCE_PRICE_BOOK = Object.freeze({
  nano: Object.freeze({ inCentsPerM: 20, outCentsPerM: 125 } as const),
  haiku: Object.freeze({ inCentsPerM: 100, outCentsPerM: 500 } as const),
} as const);
```

transcribed from BP-005's `## Public interface`, verbatim:

```ts
export const INFERENCE_PRICE_BOOK: {
  nano:  { inCentsPerM: 20;  outCentsPerM: 125 }
  haiku: { inCentsPerM: 100; outCentsPerM: 500 }
}
```

Against §1's cheapest row, the `nano` pin is **5× low on input and 4× low on
output**. Against the id the first cut of `tiers.ts` shipped (`claude-fable-5`,
corrected in `5fc4e4f`) it was 50×/40× low — that defect is fixed and
regression-guarded; this file is about the residue that the fix did not and
could not touch.

---

## 3. Why the pin matches nothing — it was never an Anthropic price

This is the part that does not rest on §1's currency. `DATA-COSTS.md` §1, the
document BP-005's own log names as the pin's source ("`INFERENCE_PRICE_BOOK`
added — … Transcribed from `DATA-COSTS.md` §1 (rule 1.2)"), reads **verbatim**:

| Model tier | $/M in · out | Used for |
|---|---|---|
| Nano class (GPT-nano / Flash-Lite) | $0.20 · $1.25 | Category inference, question phrasing, briefs, outlines, claim checks |
| **Haiku 4.5** | $1.00 · $5.00 | The grounded draft and the answerability pass |

$0.20 · $1.25 per 1M tokens is 20 · 125 ¢/MTok — the pin, exactly. **The
`nano` pin is a faithful transcription of a price for a model that is not
Anthropic's**: `DATA-COSTS.md` names the tier's candidates as GPT-nano
(OpenAI) or Flash-Lite (Google), and prices it accordingly. Nobody made an
arithmetic error. The pin is right about the model it was written for.

The charter agrees that the second tier's vendor was left open.
`00-project.md` / `BUILD.md` §1's stack row reads "**Anthropic Haiku 4.5**
(prose) + **a nano-class model** (scaffolding)" — a name for the first tier and
a *class* for the second.

And the code already carries the seam for a second vendor:
`src/lib/llm/tiers.ts` binds `apiKey: tier === "nano" ? env.NANO_API_KEY :
env.ANTHROPIC_API_KEY`, a distinct credential (BP-005 decision 6b, WO-284)
that merely *falls back* to the Anthropic key when unset.

**So the open question is not "which number is wrong". It is a decision the
corpus never recorded: which vendor sells the `nano` tier.** Both live options
are coherent, and they cost differently:

| Option | What it means | `INFERENCE_PRICE_BOOK.nano` |
|---|---|---|
| **A — nano is a second vendor's** | `NANO_API_KEY` is a real, non-Anthropic credential; a second SDK and a second transport land behind the seam | stays 20/125 — it is already correct for this option |
| **B — nano is Anthropic's cheapest** | `TIER_MODEL_IDS.nano` keeps pointing at `claude-haiku-4-5` (what ships today); the two tiers differ in price and timeout budget only | moves to 100/500 |

---

## 4. What option B costs, in the units the promise is written in

Only option B moves money, so only option B is costed here. The figures are
`RESEARCH-cost-envelope.md` §1's, not re-derived:

- The free scan makes **two** nano calls — `profile` (F5) and
  `question-phrasing` (F5b) — at **0.3¢ each, ≈0.6¢ together** (BP-025
  decision 2, quoted there verbatim: "two nano calls per scan, ≈0.6¢ rather
  than ≈0.3¢").
- Those 0.3¢ figures are computed *from the 20/125 pin*. At 100/500 the same
  tokens cost between 4× and 5× more: **≈2.4–3.0¢ for the pair, a delta of
  roughly +1.8 to +2.4¢ on every free scan.**
- `RESEARCH-cost-envelope.md` §1 puts the free scan at **6.6¢ typical · 9.0¢
  worst** against `CAPS.FREE_C` = **12¢**. Adding the delta gives roughly
  **8.4–9.0¢ typical · 10.8–11.4¢ worst** — inside the cap, with under 1¢ of
  worst-case headroom left where there were 3.0¢.
- The pair that already breaches (§1.1 there: a scan plus the one correction
  REQ-094 promises, **15.9¢ worst against 12¢**) breaches by more.

`CAPS.FREE_C` is itself **owner-ruled, not merely pinned** — BP-005's own
comment quotes the ruling of 2026-09-03 verbatim ("12c is already at the top
end of what im willing to spend … wasting money on it is a crime"), and notes
that "a later pass raising it is reversing a ruling, not tuning a pin".

**The consequence is customer-visible, which is why this file stops here.**
Under option B the free scan's ledger charges what the vendor actually bills;
under the pin as it stands the ledger under-records nano spend, so the ceiling
that decides how much of a stranger's report gets measured before the scan
degrades (ADR-021) is computed from a price the product cannot buy at.

---

## 5. What this file does and does not discharge

**Discharges:** the factual half of WO-026's fifth `rests-on` row — that
`INFERENCE_PRICE_BOOK.nano` matches no Anthropic model price known to this
corpus — now cited and dated rather than asserted on an implementer's report,
which is what the validator correctly refused to certify (§8).

**Does not discharge:** the row itself. Choosing between option A and option B
is choosing what a free scan costs to run, and the price of a promise is the
owner's under §1's decision-rights table. WO-026's row stays **`open`**,
pointing here, and **correctly blocks WO-026's `done` gate** until the owner
rules. It is not `undischargeable`: one ruling ends it.

**Explicitly not claimed here:** that no model anywhere prices at 20/125 —
§3 shows two candidate non-Anthropic ones do — nor that §1's table is current,
nor that it is exhaustive of Anthropic's catalogue today. See §0.
