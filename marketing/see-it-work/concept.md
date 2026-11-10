# See it work: concept

The landing's walkthrough video (issue #1030). It is 60 s long, 16:9 for the landing frame, with 9:16 cut-downs for social. Claude Design builds it from the ReachKit mascot artifacts it already holds. Those artifacts are not in this repository.

## Owner to do

1. **Map the mascot.** Wherever these files say `[MASCOT]`, use the existing ReachKit mascot in Claude Design. The role and personality below are only a placeholder. Correct them to fit the mascot you have.
2. **Voice-over.** Record it yourself, or approve a synthetic voice, from `script.md`. You can also approve the video with captions only. The voice-over is optional: every line is also on screen.
3. **Approve the strings.** Every on-screen string in `script.md` is either a live copy key or a short line marked *video-only*. Approve the video-only lines.
4. **Rule on the walkthrough heading.** The heading over the frame is `landing.walkthrough.heading` "See ReachKit in 2 minutes" (`src/lib/presentation/copy/keys/landing.ts:40`). This video runs 60 s. Either rule a new heading, for example "See ReachKit in 1 minute", or ask for a longer cut.
5. **Publish.** Put the mp4, the poster and the `.vtt` file in `public/` and hand #1030 to an engineer. Set `WALKTHROUGH_SRC` (`src/app/(public)/_landing/Walkthrough.tsx:7`) and add the captions track. Post the 9:16 cuts yourself. Nothing is published, posted or paid for without your go.

## Audience

Any small business owner with a website: local services, shops, hospitality, professional services, SaaS and creators. That is the landing's own label, "Works for any business with a website" (`landing.hero.kinds.label`, `landing.ts:13`). They are busy and not technical. They know customers search and ask AI, and they suspect competitors show up where they don't.

## The one message (sell the vacation)

> **Your business gets found on Google and in AI answers, and you don't lift a finger.**

The video shows the result and the free time. It does not show the machinery. Ten minutes once, then new pages go live on your own website while you do something else.

## The one call to action

**Run your free scan** at **reachkit.app**. No other ask appears anywhere in the video.

## The arc (60 s)

| Beat | Time | What the viewer feels | What is shown |
|---|---|---|---|
| 1. Hook | 0–2 s | "That's me." | A buyer asks AI what to use. The answer names others. |
| 2. Problem | 2–7 s | Mild sting | "If you're not in the answer, that buyer never meets you." |
| 3. Free scan | 7–15 s | "That's easy." | Type `yourdomain.com`, press *Scan my site*, the named stages tick. |
| 4. Report | 15–25 s | "Now I see it." | The Visibility Score, who buyers pick instead, your first page proposed free. |
| 5. One plan | 25–32 s | "That's fair." | *Start ReachKit €49*, then Stripe Checkout asks for a card and email only. |
| 6. Your part | 32–39 s | "Ten minutes? Fine." | Setup: Site · Details · Connect, "About 10 minutes, once". |
| 7. The vacation | 39–52 s | Relief | `[MASCOT]` relaxes while the week fills: *Live*, *Live*, *Tomorrow*. |
| 8. Found | 52–56 s | Pride | The Monday email, plus Google and AI-answer tracking. "You get found." |
| 9. End card | 56–60 s | Act | **Run your free scan · reachkit.app** |

## The mascot's role (placeholder: owner maps it)

- **Role.** The `[MASCOT]` stands in for the business owner's helper, the "autopilot". It does the work in the background so the owner doesn't have to. It is never shown as a customer, and it never speaks a claim that the screen does not show.
- **Personality.** Calm, capable and a little cheeky. Warm, not hype. It works quietly in beats 3 to 6 and takes a break in beat 7, because the work runs without anyone touching it. In beat 9 it points at the button.
- **Never.** It does not hold up an invented number, a fake review, a customer logo or a ranking promise.

## What is true, and the rules the video keeps

Every claim is cited to a live copy key or code in `shot-list.md`. Production was checked on 2026-11-10: `https://reachkit.app/` returns 200 and shows `landing.headline`.

- **No invented numbers.** The Visibility Score dial animates without a numeral, or with the numeral blurred. The video never shows a made-up score, a traffic figure, a ranking position or a result.
- **No invented customers.** The domain on screen is always the field's own placeholder, `yourdomain.com` (`landing.field.placeholder`, `report.ts:594`). Competitor names are blurred or replaced by the label "Competitors" (`landing.story.2.competitors`, `landing.ts:29`). Our own site, reachkit.app, is never shown as a customer.
- **No promise of rankings.** The video says pages go live and that you see where they sit on Google and in AI answers. It never says "guaranteed first page".
- **Pace, stated as live.** The live wording is "Up to 7 pages a week, new or updated" (`landing.pace`, `report.ts:599`; `WEEK_PLAN.days = 7`, `src/lib/config/constants/opportunities.ts:69`; at most one a day, SPEC §7 *One page a day*). The video never says "every day, guaranteed".
- **Where the pages live.** Pages go on the customer's own domain, at `content.yourdomain.com` after one DNS record (SPEC §5 *White-label hosted address*; `HOSTED_SUBDOMAIN_LABEL`, `src/lib/config/constants/publish.ts:227`).

## Markets

This is the EN cut. A DE cut reuses the same picture with a German voice-over and captions. Draft the DE strings once the owner approves the EN wording, using the DE copy keys where they exist (`src/lib/presentation/copy/keys/de/`).

## How we measure it (existing events only)

The video does not get its own event: a fourth event needs an owner ruling. Compare `scan_started` per landing visit, and `paid` per `scan_started`, for the 14 days before and after the video goes in the frame. Read the result as directional only, not as an experiment.
