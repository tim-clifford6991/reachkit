# See it work: shot list

Each beat of the 60 s master (`script.md` §A) is mapped to the real screen or route it depicts, the exact strings it shows, and the evidence that the claim is live. Production was checked on 2026-11-10: `https://reachkit.app/` returns 200 with `landing.headline` "Get found where your competitors are and customers search." in the page.

## Owner to do

1. **Pick the source for each screen.** Option (a): Claude Design redraws each screen as a clean UI card in the reachkit theme, using the exact strings below. This is recommended: it needs no account and shows no real customer. Option (b): you record the routes yourself on `dev.reachkit.app` and hand the clips over.
2. **Never record our own site's account as if it were a customer's.** If you do record reachkit.app's own app screens, label them "our own site" or blur the domain to `yourdomain.com`.
3. Approve blurring every competitor name and every score numeral.

**Copy-key paths:** `report.ts`, `landing.ts`, `offer.ts`, `setup.ts`, `overview.ts` and `bands.ts` are all under `src/lib/presentation/copy/keys/`.

| # | Time | Screen / route | Board (what it holds) | Exact strings shown | Claim, and the evidence it is live |
|---|---|---|---|---|---|
| 1 | 0:00–0:02 | Not a ReachKit screen: an AI answer on a phone. It follows the landing's own feature card (`src/app/(public)/_landing/Features.tsx`). | `PubLanding.dc.html` | "Buyers ask AI what to use." · question: "What's the best booking app for a small team?" | `landing.why.heading` `report.ts:573`; `landing.feature.ai.ask` `report.ts:631`. The landing uses this example question, so the video uses the same one. Answer names are blurred. |
| 2 | 0:02–0:07 | The same, with one row highlighted | `PubLanding.dc.html` | "If you're not in the answer, that buyer never meets you." · "yourdomain.com: not mentioned" | `landing.why.sub` `report.ts:574`; `landing.feature.ai.you` `report.ts:633`; `landing.field.placeholder` `report.ts:594` |
| 3 | 0:07–0:11 | `/` hero: field and button (`src/app/(public)/page.tsx`, `_landing/ScanForm.tsx`) | `PubLanding.dc.html`, `PubLandingPhone.dc.html` (9:16) | "Your website" · "yourdomain.com" · "Scan my site" · "free · no account · under a minute" | `landing.field.label` `report.ts:546`; `landing.submit.label` `report.ts:547`; `landing.hero.assurance` `report.ts:596`. SPEC §2: a scan with no account, at most 50 s. |
| 4 | 0:11–0:15 | `/scan/{domain}` while it runs: named stages (`src/app/(public)/scan/[domain]/loading.tsx`) | `PubScanning.dc.html` | "Reading your site" · "Finding your market and competitors" · "Working out your score" | `stage.reading_your_site` `report.ts:242`; `stage.reading_your_market` `report.ts:244`; `stage.scoring` `report.ts:247`. SPEC §2: named stages with elapsed times, and no spinner, percentage or countdown. **Do not draw a progress bar or a percentage.** |
| 5 | 0:15–0:20 | `/scan/{domain}` report: the verdict and score (`_address/verdict.tsx:147,178`) | `PubReport.dc.html` | "Your Visibility Score" · "of 100" | `scan.get.score` `report.ts:264`; `verdict.score.label` `report.ts:198`; `verdict.score.of` `report.ts:202`. **No numeral and no band word**, because any number would be invented. |
| 6 | 0:20–0:25 | `/scan/{domain}` report: competitors (`_modules/buyers.tsx`) and the free page (`_modules/free-page.tsx:55`) | `PubReport.dc.html` | "Who buyers pick instead" · "Competitors" · "Your first page, free" | `landing.glance.rivals` `report.ts:608` (the landing's view of the report); `landing.story.2.competitors` `landing.ts:29`; `free-page.title` `report.ts:515`. SPEC §2: the report carries one first-page proposal. |
| 7 | 0:25–0:32 | Report price close (`_modules/pricing.tsx:160`), then Stripe Checkout (hosted by Stripe) | `PubReport.dc.html`, `Pricing.dc.html` | "Start ReachKit €49" · "€49 a month · VAT included · cancel any time" | `offer.start.priced` `offer.ts:53`; `price.amount` `offer.ts:33`; `landing.plan.terms` `landing.ts:69`. SPEC §3: Stripe Checkout at €49/month tax included, no account beforehand, card and email only. Draw only an email and a card field. |
| 8 | 0:32–0:39 | `/setup` (`src/app/(account)/setup/page.tsx`, `steps.ts`), then `/setup/connect` | `Setup1.dc.html`, `Setup2.dc.html`, `Setup.dc.html` | "Site" · "Details" · "Connect" · "About 10 minutes, once" · "Connect your website" | `setup.step.site` `setup.ts:392`; `setup.step.check` `setup.ts:393`; `setup.step.publishing` `setup.ts:394`; `setup.step.time` `setup.ts:396`; `setup.connect.title` `setup.ts:559`. SPEC §5: three saved steps. Checkout lands signed in on `/setup` (SPEC §3). |
| 9 | 0:39–0:52 | `/app` This week: day cards with stages (`src/app/(account)/app/(tabs)/page.tsx`), then a hosted page on `content.yourdomain.com` (`src/app/(hosted)/hosted-page`) | `Main.dc.html`, `Plan.dc.html`, `HostedArticle.dc.html` | "Live" · "Tomorrow" · "Up to 7 pages a week, new or updated. Never filler." · "Each page waits 24 hours before it goes live. Edit it, stop it, or do nothing." | `landing.story.3.live` `landing.ts:35`; `landing.story.3.next` `landing.ts:36`; `landing.pace` `report.ts:599` with `WEEK_PLAN.days = 7` (`constants/opportunities.ts:69`); `landing.plan.control.line` `landing.ts:67` with `VETO.defaultHours = 24` (`constants/publish.ts:5`). SPEC §7 *One page a day* and *Autopilot only*; SPEC §5 *White-label hosted address* with `HOSTED_SUBDOMAIN_LABEL = "content"` (`constants/publish.ts:227`). The hosted page carries the customer's mark, not ReachKit's (SPEC §5), so **do not put the ReachKit logo on the hosted page**. |
| 10 | 0:52–0:56 | The Monday email, plus the app's Google and AI-answer tabs (`/app/search`, `/app/ai-answers`) | `MondayMail.dc.html`, `AppGoogle.dc.html`, `AppAI.dc.html` | "pages live" · "planned this week" · "Google" · "AI answers" · "You get found" | `landing.mail.live` `landing.ts:48`; `landing.mail.planned` `landing.ts:49`; `landing.story.engine.google` `landing.ts:25`; `landing.story.engine.ai` `landing.ts:26`; `landing.story.4.title` `landing.ts:23`; `landing.plan.tracking.line` `landing.ts:63`; `landing.step.3.body` `report.ts:618`. **No ranking position, no traffic number and no chart with values.** |
| 11 | 0:56–1:00 | End card (not a screen) | none | "Run your free scan" · "reachkit.app" | The CTA is the free scan at `/` (`landing.start.cta` `report.ts:577`). The URL is the production host. |

## Do-not-show list

- Any score numeral, band word ("Invisible", "Hard to find" and so on, `bands.ts:31-34`), traffic figure, ranking position or "before/after" number.
- Any real company name or logo, other than ReachKit's own wordmark on the end card.
- A spinner, progress percentage or countdown on the scan (SPEC §2).
- An "Approve" button. There is none: autopilot only (SPEC §7).
- A `*.reachkit.app` address for a customer page (SPEC §7 *No preview host*).
- Tiers, a trial or an add-on. There is one plan (SPEC §3, `plan.single` `offer.ts:86`).
- WordPress connect. It is behind a flag that is off (SPEC §5 *DNS only at launch*).

## Hand-off when the file exists (engineer, #1030)

Put `public/see-it-work.mp4`, a poster image and `public/see-it-work.en.vtt` in place. Set `WALKTHROUGH_SRC` (`src/app/(public)/_landing/Walkthrough.tsx:7`). Add a `<track kind="captions">` and the poster. The player stays without autoplay and with `preload="none"`. The heading (`landing.walkthrough.heading`) is changed per the owner's ruling. Done when the video plays on dev and production at 390 / 768 / 1280.
