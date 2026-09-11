---
id: PROJECT
type: charter
title: "ReachKit"
status: draft
source: BUILD.md v1.1 (2026-08-28) · DATA-COSTS.md v1.1
---

# ReachKit — project charter

## What this is

A founder gives us a URL. We measure how findable they are — in Google and in
AI answers — against competitors they confirm. From that we derive a ranked
list of pages worth publishing, write one per day, and publish it to a blog on
their own domain (or their WordPress) after a 24-hour veto window. Every Monday
we re-measure and show what moved.

€49/mo flat. Pay before account. COGS ~€2.50/customer/month (~95% gross margin).

## State of the repo

Greenfield. No source code on disk yet — this repo currently holds only the
specification (`BUILD.md`, `DATA-COSTS.md`) and this factory. The shipped
reachkit.app repo is **reference, not substrate**: read it for proven patterns
(SSRF fetcher, cost seam, Stripe webhook handling) and reimplement to spec;
copy no file wholesale.

`BUILD.md` is the incoming specification, not a factory artifact. Requirements
are transcribed from it into `requirements/`; once transcribed, the REQ is the
authority and `BUILD.md` is cited evidence.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, hosted on Vercel |
| Styling | Tailwind CSS 4 + daisyUI 5, tokens per BUILD §2.1 |
| Fonts | Plus Jakarta Sans (UI) · JetBrains Mono (all numerals), self-hosted via `@fontsource` |
| Icons | lucide-react |
| DB + auth | Supabase — Postgres, RLS default-deny, magic-link auth; `dbAdmin` server-only |
| Payments | Stripe Checkout + customer portal + signature-verified webhook |
| Email | Resend, behind one `sendEmail()` seam, one branded shell, plain-text alt |
| Jobs | Inngest (or Vercel cron + queue) |
| Search data | DataForSEO — Labs, SERP, AI Optimization |
| Inference | Anthropic Haiku 4.5 (prose) + a nano-class model (scaffolding), behind one `llm()` seam with per-call cost logging |

## Repo shape and entry points

Standard Next.js.

| Path | Holds |
|---|---|
| `src/app/` | The surfaces — `/`, `/scan/{domain}`, `/setup`, `/app` (Overview · Calendar · Settings), the Host-keyed edge route serving hosted-CMS pages |
| `src/lib/` | The engine — measure, score, opportunities, generate, publish, costs |
| `src/lib/config/constants.ts` | **Every** pinned number in the specification |
| `tests/pins.test.ts` | Asserts those constants |

Public URL contract, unchanged from the shipped app: `/scan/{domain}` is the
public report path, and the order report → checkout → magic link → `/setup`
is fixed.

## Standing laws

These bind every requirement, blueprint and work order below them.

1. **Design before code.** Any new or visually changed surface is mocked as an
   artifact on the §2 design system and approved before its milestone starts.
2. **Simplicity is the product.** Zero SEO knowledge required to read any
   screen. Meaning over data: a number that answers no customer question is not
   rendered, even if we hold it.
3. **No generated prose in the UI.** LLM output appears in exactly one place —
   draft page content, always labelled. Every other interface sentence is a
   written string in the codebase.
4. **Lean data is a law.** BUILD §6 lists every dataset the product may pull. A
   vendor call not in that table does not ship. Every call goes through the cost
   seam, reads cache first, respects its freshness window. "It's cheap" is not a
   reason.
5. **One claim, one home.** Every constant — price, cap, limit, copy string —
   is defined once. Every UI number traces to a stored measurement with a date.

**Compliance guardrails are features, not policy** (BUILD §14): volume follows
supply · no invented authors · near-duplicate gate · no doorway pages ·
grounding · customer is publisher of record (`*.reachkit.app` noindex forever) ·
autopilot rate limits independent of the monthly cap. We make pages
structurally citable; we never engineer content to steer an assistant.

## Cost envelope

Enforced in the seam, not assumed. Caps are hard.

| | Target | Cap |
|---|---|---|
| 1 free report | ~6¢ | 12¢ |
| 1 paid deep scan | ~30¢ (weekly refresh ~8¢) | 150¢ |
| 1 day of content | ~7¢ | 45¢ |

The four cost dangers, in order: battery growth (question/engine/run counts stay
pinned) · live-mode creep (live is justified once — the free report's 60s
promise) · row-limit creep · model creep. A new spend site needs its own
price-book row before it ships.

## Delivery spine

Ten milestones (BUILD §16), each ending in a check it must pass to be done:
design system + screens on fixtures → measurement engine → free scan pipeline →
questions + giveaway + lead capture → Stripe + provisioning + setup → deep scan
+ opportunities + calendar → generation + veto → hosted CMS + publish → autopilot
+ jobs + emails → WordPress + billing. **Sellable at M4, chargeable at M7.**

## Non-goals

Engine-tuning settings · feature flags · crawler or sitemap reader · LLM-written
UI text or emails · a second score · multi-site · approval workflows, comments
or content calendars beyond BUILD §4.6 · images in drafts · backlinks, local, or
per-country SERPs · Perplexity · Webflow/Shopify/Ghost/Framer/Notion · community
outreach of any kind.

## Open questions

- [ ] BUILD §1 says "build fresh in `ReachKitV2`"; this directory is
      `ReachKitV3`. Confirm this repo is the intended home. (owner: user)
- [ ] Test runner is unnamed in the spec — `tests/pins.test.ts` implies one.
      System to choose at M1 and record as an ADR; no owner input needed.
- [ ] `factory.config.json` has `schema: null` because `supabase/migrations/`
      does not exist yet. Repoint it to Supabase at M1, when migrations land.
