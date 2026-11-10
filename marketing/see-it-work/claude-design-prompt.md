# See it work: Claude Design prompt

## Owner to do

1. Open Claude Design in the project that holds the existing ReachKit mascot artifacts.
2. Replace `[MASCOT]` below with the mascot's name, or attach its artifacts. Correct the personality line if it doesn't fit.
3. Attach the voice-over audio if you recorded one. Otherwise leave it out: the prompt asks for captions only and a music bed.
4. Paste everything between the two rules below. Review the result against `shot-list.md` › *Do-not-show list* before you publish anything.

---

Make one animated product video for ReachKit, plus two cut-downs, using the **existing ReachKit mascot artifacts in this project** (`[MASCOT]`). Do not redesign or replace the mascot. Pose and animate the existing one.

**What ReachKit is.** A service for small businesses. You run a free scan of your website and get a free report with a Visibility Score. Then, for €49 a month, ReachKit writes pages for your business and puts them live on your own website, up to 7 a week, so you get found on Google and in AI answers without lifting a finger.

**The one message.** Your business gets found on Google and in AI answers, and you don't lift a finger. Sell the outcome and the free time, not the technology.

**Audience.** Any small business owner with a website: local services, shops, hospitality, professional services, software and creators. Busy and not technical. Keep it universal: no single industry, city or person.

**The mascot's role.** `[MASCOT]` is the owner's helper, the autopilot. It is calm, capable, warm and a little cheeky, never loud or hype. It does the work in the background in scenes 3–6, takes a well-earned break in scene 7 (hammock or deck chair, whatever suits the mascot) while pages go live by themselves, and points at the button on the end card. It never holds a number, a review, a logo or a trophy.

### Style

- Flat, clean product animation. UI appears as simplified cards drawn from the strings below, not as pixel-perfect screenshots. Rounded corners: 14 px on cards, 9 px on fields and buttons, pill-shaped badges. Hairline 1 px borders. Generous white space.
- **Palette (the reachkit theme, light):** background `#ffffff`, soft panel `#eef0f8`, border/divider `#e8e9f3`, text `#1e2233`, primary (buttons, highlights, the CTA) `#5b4be0` with white text `#ffffff`, success/"Live" `#1b765b`, warning `#945c22`, error/"not mentioned" `#b84029`. Use the primary as the only strong accent. For a dark end-card variant: background `#161a21`, text `#dde3eb`, primary `#9bb4ff` with text `#0e1116`.
- **Type:** Plus Jakarta Sans for everything, bold for headlines and regular for body. JetBrains Mono only for the web address `yourdomain.com` and `content.yourdomain.com`.
- No stock photos, no real brand logos except the ReachKit wordmark, and no real company names. Blur any competitor name, or show it as grey bars labelled "Competitors".

### Motion and pacing

- 30 fps. Cuts land on the beat of a light, optimistic, low-tempo music bed. Ease in and out at 250–400 ms for UI cards. Typing moves at about 12 characters per second. A badge flipping to "Live" gets a small, satisfying pop.
- One idea on screen at a time. On-screen text appears within 0.3 s of the scene start and holds at least 1.5 s.
- The first 2 seconds must hook on their own, without sound.

### Aspect ratios and deliverables

1. **Master: 60 s, 16:9, 1920×1080.** This plays on the landing page with sound off by default. It must read fully with captions only.
2. **Cut-down: 30 s, 9:16, 1080×1920.**
3. **Cut-down: 15 s, 9:16, 1080×1920.**

For 9:16, keep all text and the mascot inside the centre safe area (leave about 250 px clear top and bottom). Export each as MP4 (H.264), with a poster frame (the end card) as PNG and captions as WebVTT. Burn captions into the 9:16 cuts only. The 16:9 master gets a separate `.vtt` and no burned-in captions.

### Captions

Sentence case, two lines at most, about 32 characters per line, in Plus Jakarta Sans on a `#1e2233` box at 85% opacity with white text, bottom centre. Captions follow the voice-over text below word for word.

### Exact on-screen strings: use these, character for character. Add no other claims.

**Master, 60 s, 16:9**

| Time | Scene | On-screen text | Voice-over / caption |
|---|---|---|---|
| 0:00–0:02 | **Hook.** A phone. An AI answer types out under the question "What's the best booking app for a small team?" Three blurred names appear. `[MASCOT]` peeks in from the edge and frowns. | Buyers ask AI what to use. | Your buyers ask AI what to use. |
| 0:02–0:07 | A row under the answer is highlighted in `#b84029`: "yourdomain.com: not mentioned". Everything else dims. | If you're not in the answer, that buyer never meets you. | If you're not in the answer, they never meet you. |
| 0:07–0:11 | A simple web page hero with one field labelled "Your website". A cursor types "yourdomain.com" and presses the primary button "Scan my site". | free · no account · under a minute | So type your website. The scan is free, with no account, and takes under a minute. |
| 0:11–0:15 | A vertical list of named steps, each ticking in turn: "Reading your site", "Finding your market and competitors", "Working out your score". **No spinner, no percentage, no progress bar, no countdown.** `[MASCOT]` busily reads. | (the three step names) | (music only) |
| 0:15–0:20 | A report card. A ring-shaped dial fills in the primary colour. **Do not show any number in the dial**: leave the centre blurred or as a soft dot. Beside it, the small text "of 100". | Your Visibility Score | You get your Visibility Score: how easy you are to find, |
| 0:20–0:25 | The report scrolls. First a card titled "Who buyers pick instead" with three grey blurred rows labelled "Competitors". Then a card titled "Your first page, free" with a small green "free" badge. | Who buyers pick instead → Your first page, free | who buyers pick instead, and your first page, free. |
| 0:25–0:32 | A primary button "Start ReachKit €49" is pressed. A simple checkout card slides in with **only** an email field and a card field. | €49 a month · VAT included · cancel any time | Want it done for you? One plan. Forty-nine euros a month, VAT included. No account first. |
| 0:32–0:39 | Three short bars labelled "Site", "Details", "Connect" fill one by one. On "Connect", `[MASCOT]` hands over a sticky note showing one line of settings. | About 10 minutes, once | Answer a few questions and connect your site. About ten minutes, once. That's your part. |
| 0:39–0:52 | **The vacation.** `[MASCOT]` leans back and relaxes. Beside it, a week of day cards flips one at a time to green "Live" badges: Live, Live, Live, then a grey "Tomorrow". A browser window shows the address "content.yourdomain.com" and a fresh, clean article page, with **no ReachKit logo on that page**. | Up to 7 pages a week, new or updated. Never filler. → Each page waits 24 hours before it goes live. Edit it, stop it, or do nothing. | Then ReachKit researches your market and writes pages from facts on your own site. They go live on your website, up to seven a week. Stop any page, or do nothing. |
| 0:52–0:56 | An inbox. An email titled "The Monday email" arrives, showing "pages live" and "planned this week". Two chips light up: "Google" and "AI answers". **No numbers, charts with values, or ranking positions.** | You get found | Every Monday, an email shows what went live, and where you sit on Google and in AI answers. |
| 0:56–1:00 | **End card.** White background, ReachKit wordmark top left, `[MASCOT]` pointing at one large primary button. | Run your free scan · reachkit.app | Run your free scan at reachkit.app. |

**Cut-down, 30 s, 9:16**

| Time | Scene | On-screen text | Voice-over / caption |
|---|---|---|---|
| 0:00–0:02 | The phone hook, as in the master | Buyers ask AI what to use. | Your buyers ask AI what to use. |
| 0:02–0:05 | "yourdomain.com: not mentioned" highlighted | If you're not in the answer, that buyer never meets you. | Are you in the answer? |
| 0:05–0:10 | Type "yourdomain.com", press "Scan my site", the steps tick | free · no account · under a minute | Find out with a free scan. Under a minute. |
| 0:10–0:15 | The dial fills (no number), then "Your first page, free" | Your Visibility Score | See your Visibility Score, and your first page, free. |
| 0:15–0:19 | "Start ReachKit €49" opens checkout (email and card only) | €49 a month · VAT included · cancel any time | Then one plan, forty-nine euros a month. |
| 0:19–0:26 | `[MASCOT]` relaxes, day cards flip Live, Live, Tomorrow | Up to 7 pages a week, new or updated. Never filler. | ReachKit writes pages for your site and puts them live. Stop any page, or do nothing. |
| 0:26–0:30 | End card | Run your free scan · reachkit.app | Run your free scan at reachkit.app. |

**Cut-down, 15 s, 9:16**

| Time | Scene | On-screen text | Voice-over / caption |
|---|---|---|---|
| 0:00–0:02 | The phone hook | Buyers ask AI what to use. | Your buyers ask AI what to use. |
| 0:02–0:06 | Type "yourdomain.com", press "Scan my site", the dial fills (no number) | free · no account · under a minute | See if they find you. Free scan, under a minute. |
| 0:06–0:11 | `[MASCOT]` relaxes, day cards flip Live, Live, Tomorrow | Up to 7 pages a week, new or updated. Never filler. | Then ReachKit puts pages live on your site, on autopilot. |
| 0:11–0:15 | End card | Run your free scan · reachkit.app | Run your free scan at reachkit.app. |

### End card (all three)

The headline "Run your free scan" is a large primary button in `#5b4be0` with white text. Under it sits "reachkit.app" in `#1e2233`. The ReachKit wordmark is top left and `[MASCOT]` points at the button. Hold it for the full last 4 s (the last 4 s in the 15 s cut too), with no other text.

### Hard rules: break none

- Show no number other than "€49", "7", "24", "10" and "100" exactly where written above. No score, no traffic, no rank, no percentage, no star rating, no "x% more customers".
- No testimonials, quotes, reviews, customer names, customer logos or real company names.
- No promise of a ranking ("#1 on Google", "guaranteed", "first page of Google").
- No "Approve" button. No tiers, trial or "Pro" plan. No spinner or progress percentage on the scan.
- The only web addresses shown are "yourdomain.com", "content.yourdomain.com" and "reachkit.app".
- One call to action only: **Run your free scan**.

---
