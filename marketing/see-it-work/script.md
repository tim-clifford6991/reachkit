# See it work: script

**Audience:** any small business owner with a website. **Message:** you get found on Google and in AI answers without lifting a finger. **CTA:** Run your free scan at reachkit.app. Evidence for every line is in `shot-list.md`.

## Owner to do

1. Map `[MASCOT]` to the existing mascot in Claude Design.
2. Record the voice-over, or approve a synthetic voice, or approve the video with captions only. The VO is about 120 words at a calm pace.
3. Approve the four lines marked *video-only*. Every other on-screen string is a live copy key.
4. Rule on `landing.walkthrough.heading` "See ReachKit in 2 minutes" (`landing.ts:40`). This cut runs 60 s.

**Key:** **OS** is on-screen text, drawn in the frame. **VO** is the voice-over. **CC** is the caption. Captions follow the VO word for word, at most two lines and about 32 characters a line. Strings in `code` quotes are live copy keys, cited in `shot-list.md`.

---

## A. Master: 60 s, 16:9 (landing frame, 1920×1080)

| Time | Picture | OS (exact) | VO |
|---|---|---|---|
| **0:00–0:02 HOOK** | A phone fills the frame. An AI answer types itself out to the question "What's the best booking app for a small team?" Three names appear, blurred. `[MASCOT]` peeks in from the edge and frowns. | **Buyers ask AI what to use.** | "Your buyers ask AI what to use." |
| 0:02–0:07 | The answer stays. A row below reads "yourdomain.com: not mentioned". Everything dims except that row. | **If you're not in the answer, that buyer never meets you.** | "If you're not in the answer, they never meet you." |
| 0:07–0:11 | The landing hero. A cursor types `yourdomain.com` into the field "Your website" and presses **Scan my site**. | **free · no account · under a minute** | "So type your website. The scan is free, with no account, and takes under a minute." |
| 0:11–0:15 | The scanning screen. The named stages tick by in order: "Reading your site", then "Finding your market and competitors", then "Working out your score". | (the stage names, as drawn) | (music only) |
| 0:15–0:20 | The report. The Visibility Score dial fills. **No numeral is shown** (blurred or held as a dot), and "of 100" sits beside it. | **Your Visibility Score** · "of 100" | "You get your Visibility Score: how easy you are to find," |
| 0:20–0:25 | The report scrolls to the competitors, labelled "Competitors" with names blurred, then to the card **Your first page, free**. | **Who buyers pick instead** → **Your first page, free** | "who buyers pick instead, and your first page, free." |
| 0:25–0:32 | The report's price close. A cursor presses **Start ReachKit €49**. Stripe Checkout slides in with only an email field and a card field. | **€49 a month · VAT included · cancel any time** *(video-only line, built from `price.amount` + `landing.plan.terms`)* | "Want it done for you? One plan. Forty-nine euros a month, VAT included. No account first." |
| 0:32–0:39 | Setup, with the three bars **Site · Details · Connect** filling one by one. `[MASCOT]` hands over a sticky note showing the one DNS record. | **About 10 minutes, once** | "Answer a few questions and connect your site. About ten minutes, once. That's your part." |
| **0:39–0:52 THE VACATION** | `[MASCOT]` leans back: hammock, deck chair, or whatever fits the mascot. Beside it, This week's day cards flip one at a time, each with a badge: **Live**, **Live**, **Live**, **Tomorrow**. A browser tab opens at `content.yourdomain.com` showing a fresh page. | **Up to 7 pages a week, new or updated. Never filler.** → **Each page waits 24 hours before it goes live. Edit it, stop it, or do nothing.** | "Then ReachKit researches your market and writes pages from facts on your own site. They go live on your website, up to seven a week. Stop any page, or do nothing." |
| 0:52–0:56 | An inbox. The Monday email arrives with "pages live" and "planned this week". Two small chips, **Google** and **AI answers**, light up. | **You get found** | "Every Monday, an email shows what went live, and where you sit on Google and in AI answers." |
| **0:56–1:00 END CARD** | A clean card in the reachkit theme. `[MASCOT]` points at the button. The ReachKit wordmark sits top left. | **Run your free scan** *(video-only CTA)* · **reachkit.app** | "Run your free scan at reachkit.app." |

### Master captions (WebVTT, `see-it-work.en.vtt`)

```
WEBVTT

00:00.000 --> 00:02.000
Your buyers ask AI what to use.

00:02.000 --> 00:07.000
If you're not in the answer,
they never meet you.

00:07.000 --> 00:11.000
So type your website. The scan is free,
with no account, and takes under a minute.

00:15.000 --> 00:20.000
You get your Visibility Score:
how easy you are to find,

00:20.000 --> 00:25.000
who buyers pick instead,
and your first page, free.

00:25.000 --> 00:28.500
Want it done for you? One plan.

00:28.500 --> 00:32.000
€49 a month, VAT included.
No account first.

00:32.000 --> 00:39.000
Answer a few questions and connect your site.
About ten minutes, once. That's your part.

00:39.000 --> 00:45.500
Then ReachKit researches your market and
writes pages from facts on your own site.

00:45.500 --> 00:52.000
They go live on your website, up to seven
a week. Stop any page, or do nothing.

00:52.000 --> 00:56.000
Every Monday, an email shows what went live,
and where you sit on Google and in AI answers.

00:56.000 --> 01:00.000
Run your free scan at reachkit.app.
```

---

## B. Cut-down: 30 s, 9:16 (1080×1920, Reels, TikTok, Shorts, LinkedIn)

Keep text in the centre 1080×1420 safe area, away from the platform UI at the top 250 px and bottom 250 px. Captions are burned in.

| Time | Picture | OS | VO |
|---|---|---|---|
| **0:00–0:02 HOOK** | The phone with the AI answer, three names blurred. `[MASCOT]` frowns. | **Buyers ask AI what to use.** | "Your buyers ask AI what to use." |
| 0:02–0:05 | "yourdomain.com: not mentioned" is highlighted. | **If you're not in the answer, that buyer never meets you.** | "Are you in the answer?" |
| 0:05–0:10 | Type `yourdomain.com`, press **Scan my site**, the stages tick. | **free · no account · under a minute** | "Find out with a free scan. Under a minute." |
| 0:10–0:15 | The score dial fills (no numeral), then **Your first page, free**. | **Your Visibility Score** | "See your Visibility Score, and your first page, free." |
| 0:15–0:19 | **Start ReachKit €49** opens Checkout. | **€49 a month · VAT included · cancel any time** | "Then one plan, forty-nine euros a month." |
| 0:19–0:26 | `[MASCOT]` relaxes. Day cards flip **Live**, **Live**, **Tomorrow**. | **Up to 7 pages a week, new or updated. Never filler.** | "ReachKit writes pages for your site and puts them live. Stop any page, or do nothing." |
| 0:26–0:30 | End card. | **Run your free scan** · **reachkit.app** | "Run your free scan at reachkit.app." |

## C. Cut-down: 15 s, 9:16

| Time | Picture | OS | VO |
|---|---|---|---|
| **0:00–0:02 HOOK** | The AI answer names others. `[MASCOT]` frowns. | **Buyers ask AI what to use.** | "Your buyers ask AI what to use." |
| 0:02–0:06 | Type `yourdomain.com`, press **Scan my site**, the score dial fills. | **free · no account · under a minute** | "See if they find you. Free scan, under a minute." |
| 0:06–0:11 | `[MASCOT]` relaxes. Day cards flip **Live**, **Live**, **Tomorrow**. | **Up to 7 pages a week, new or updated. Never filler.** | "Then ReachKit puts pages live on your site, on autopilot." |
| 0:11–0:15 | End card. | **Run your free scan** · **reachkit.app** | "Run your free scan at reachkit.app." |

The 30 s and 15 s captions are the VO lines above, timed to the same cells. Claude Design exports a `.vtt` for each cut.

## Video-only lines (owner approves)

| Line | Built from | Why it holds |
|---|---|---|
| "€49 a month · VAT included · cancel any time" | `price.amount` (`offer.ts:33`) + `landing.plan.terms` (`landing.ts:69`) | The same facts, joined on one line |
| "Run your free scan" | `landing.start.cta` "Scan my site for free" (`report.ts:577`) | The owner's CTA wording for this brief |
| "yourdomain.com: not mentioned" | `landing.feature.ai.you` "{you}: not mentioned" (`report.ts:633`), filled with `landing.field.placeholder` | The live pattern, with the placeholder domain |
| VO "Are you in the answer?" (30 s only) | `landing.why.sub` (`report.ts:574`) | A question form of the live line |
