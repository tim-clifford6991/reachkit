# R4: Outreach scripts (EN)

**Audience:** owners in `icp-and-sources.md` scoring 6 or more. **Message:** "AI answers send your
buyers to someone else, and you can see it free." **Call to action:** run the free scan on your own
domain. One ask per message. DE versions follow before wave 3 (playbook §4).

## Owner to do

- [ ] Edit every script into your own voice before the first send (they are drafts).
- [ ] Make the booking link (R7) and paste it where `{booking}` stands.
- [ ] trust-compliance confirms the cold email script (UK and US only) before any cold send.
- [ ] You send every message yourself. Nothing here is sent by an agent.

## Rules for every message

| Rule | Why |
|---|---|
| Link the scan with the channel tag: `https://reachkit.app/?ref={channel}` (README › Channel links) | D7. The tag is not stored yet, so also ask "where did you hear of us?" and write it in `heard_from` |
| Never scan their site for them; they run it | Every scan is a public card on `/scans` (SPEC §2 *Gallery lists every report*, `docs/SPEC.md:162`) |
| Say "up to 7 pages a week, new or updated", never "a page a day" | SPEC §1 *The pace* (`docs/SPEC.md:94`); `offer.cadence.page` (`src/lib/presentation/copy/keys/offer.ts:36`) |
| No guarantee or refund line in a post or on a page; only in a one-to-one message or call | README rule 1; D2 |
| Name no rival product; a prospect's own rivals from their own report are fine | `offer.md` |
| No promised ranking, mention or result | `landing.faq.results.short` (`report.ts:678`): "Google takes weeks to months" |
| Stop after the day-7 follow-up | Playbook §2 |

Placeholders: `{name}`, `{company}`, `{domain}`, `{category}` (their market in plain words),
`{rival A}`, `{rival B}`, `{exact question}`, `{signal}`, `{wave}`, `{close date}`, `{booking}`,
`{channel}`.

Wave close dates (D4): wave 1 **6 Dec 2026**, wave 2 **20 Dec 2026**, wave 3 **31 Jan 2027**.

---

## 1. Warm opener (ACA: acknowledge, compliment, ask)

**Channel:** WhatsApp, LinkedIn message, personal email. People you know only.
**Goal:** a reply. No pitch, no price.

> Hey {name}, saw {specific recent thing}, congrats, that's a big one.
>
> Quick question: when people ask ChatGPT or Google for {category}, do you know who they're sent
> to? I built a free scan that shows exactly that, for your site and your competitors. Want to run
> it on {domain}? No signup: https://reachkit.app/?ref={channel}

**Shorter (WhatsApp):**

> Hey {name}! Random one: do you know who ChatGPT recommends when someone asks for {category}? I
> built a free check for it. Run it on {domain} if you're curious:
> https://reachkit.app/?ref=whatsapp

Evidence: the report's first card is *Who gets your buyers* (`report.buyers.title`,
`report.ts:876`), and its headline names the business buyers are sent to most (`report.top.line`,
`report.ts:869`). No account before the scan (SPEC §1 *One field*).

## 2. Cold signal opener

**Channel:** LinkedIn connection note or message (any country); email to UK and US companies only,
after trust-compliance's yes. Germany: LinkedIn and the owner's network only (README rule 3).
**Before sending:** ask ChatGPT, Perplexity or Google AI the `{exact question}` by hand and record
the answer in `leads.csv` (`ai_answer_gap`). Never run a ReachKit scan of their site.

**LinkedIn (under 300 characters for a connection note):**

> Hi {name}, I asked ChatGPT "{exact question}". It named {rival A} and {rival B}, not {company},
> even with your {signal}. I built a free scan that shows where AI sends your buyers. Happy to share.

**Email (UK and US):**

> Subject: ChatGPT recommends {rival A} for {category}
>
> Hi {name},
>
> I asked ChatGPT "{exact question}" this week. It named {rival A} and {rival B}. It didn't name
> {company}, even though you {signal: e.g. have 120 five-star reviews}.
>
> I built a free scan that shows which businesses Google and AI answers send your buyers to, and
> the questions your buyers ask that no page of yours answers. It's free and needs no signup:
> https://reachkit.app/?ref=email
>
> Worth a look?
>
> Tim, founder of ReachKit
> {postal address and one-line opt-out, as trust-compliance rules for UK and US mail}

Evidence: the report lists *Pages you're missing* (`report.missing.title`, `report.ts:846`) and
"We found {count} questions your buyers ask that no page of yours answers" (`report.top.offer`,
`report.ts:873`).

## 3. After the scan (with the walkthrough video)

**When:** within 24 hours of their scan. **Goal:** a call or a payment. This is the first message
with a price, and the first with the offer. Record the video with `walkthrough-video.md` first.

> Hi {name}, here's a 5-minute walkthrough of your report: {video link}
>
> The short version: when buyers ask about {category}, Google and AI send them to {rival A} most.
> You came up in {n} of {m}. {One gap in their words, e.g. "Nobody on your site answers 'how much
> does a bathroom refit cost'."}
>
> ReachKit closes that gap for you: up to 7 pages a week, new or updated, written from facts on
> your own site and published there. Each Monday an email shows what went live and what moved.
>
> I'm taking 50 founding customers and setting each one up personally. You get setup with me on a
> 15-minute call, check-ins at day 14 and day 30, and my direct line. €49 a month, VAT included,
> cancel any time, and the price stays at €49 for as long as you stay.
>
> Wave {wave} closes {close date}. Book 15 minutes: {booking}. Or start straight from your report:
> https://reachkit.app/scan/{domain}

Evidence: pace (`offer.ts:36`), facts from their site (`setup.business.assurance`,
`setup.ts:456`), Monday email (`offer.cadence.movement`, `offer.ts:37`), €49 VAT included
(`landing.plan.terms`, `landing.ts:69`), cancel any time (`landing.faq.stop.short`,
`report.ts:679`). The founding bonuses and price lock are the owner's (D1, D4), not product
features.

**If they ask "what if it doesn't work?"** (one to one only, never in a post; D2):

> You see everything before you pay: your free report, and a first page you can read free from
> it. So I don't do refunds. What I do promise: if your first page isn't live within 48 hours of
> connecting your site, I get on a call and do it with you.

## 4. Follow-up, day 3 (no reply)

**Goal:** a reply. One new thing, no guilt.

To a no-reply on the opener:

> Hi {name}, one more thing I noticed: {one concrete finding from asking AI by hand, e.g. "for
> 'best {category} in {city}', Google's AI quotes {rival A}'s pricing page"}. The free scan shows
> the whole picture for {domain}: https://reachkit.app/?ref={channel}

To a no-reply after the walkthrough:

> Hi {name}, did the walkthrough make sense? Happy to answer anything in a reply here, no call
> needed. Wave {wave} has {places left} founding places left.

Only say the places left if the number is the real count from the Progress table.

## 5. Follow-up, day 7 (last)

**Goal:** a clean close. After this, stop.

> Hi {name}, I'll leave it here so I'm not cluttering your inbox. If you want to see who AI sends
> your buyers to, the scan stays free: https://reachkit.app/?ref={channel}. Good luck with
> {specific thing}.

After a walkthrough:

> Hi {name}, last note from me. Wave {wave} closes {close date}, and the setup call and price lock
> close with it. If the timing's wrong, no problem: your report stays at
> https://reachkit.app/scan/{domain}.

## 6. The call agenda (15 minutes, CLOSER)

**Before the call:** open their report at `/scan/{domain}`, the setup checklist (`setup-call.md`),
and their row in the private `leads.csv`.

| Min | Step | Say or do |
|---|---|---|
| 0–1 | Clarify | "What made you run the scan?" Let them talk. |
| 1–3 | Label | "So buyers ask about {category}, they're sent to {rival A}, and you don't have time to write. Is that it?" |
| 3–5 | Overview past pain | "What have you tried? What happened?" (agency, freelancer, writing it yourself, ChatGPT) |
| 5–8 | Sell the vacation | "Here's what changes: pages go live on your own site every week, up to 7, new or updated, written from facts on your site. You can edit or stop any page before it goes live, or do nothing. Each Monday an email shows what went live and where it sits in Google and AI answers. Your part is a few questions and one setting, which we do now." |
| 8–11 | Explain away concerns | Objections below |
| 11–15 | Reinforce | "Want to start? Pay from your report, then we connect your site together right now." Then `setup-call.md`. |

### Objections (answers true today)

| They say | Answer | Evidence |
|---|---|---|
| "Too expensive" | "Compare it with what one page costs. Freelance writers most often charge $250–399 for a long blog post. This is €49 a month for up to 7 pages a week." | `price-anchors.md` A1 |
| "I'll think about it" | "Sure. What would you need to see? Wave {wave} closes {close date}, and the setup call and the price lock close with it." | D4 |
| "SEO didn't work before" | "You've seen the report before paying. And every Monday the email shows what moved, so you're never guessing." | `offer.ts:37` |
| "I can do it with ChatGPT" | "You can. The question is whether you'll research, write, check and publish up to 7 pages every week." | `offer.ts:36` |
| "Is this AI spam?" | "No. Claude, an AI model, writes each page from your site and linked sources. A page that fails its checks twice never goes live." | `landing.faq.spam.a`, `report.ts:658` |
| "Will Google penalise AI content?" | Not answered yet: seo-master gives the approved answer before wave 1. Until then: "Good question; I'll send you a straight answer in writing." | Hand-off |
| "I'm not technical" | "We connect it together on this call. It's one setting where you bought your web address." | `landing.faq.start.a`, `report.ts:668` |
| "I'm on WordPress" | "Today we publish on a part of your own address, like content.yourdomain.com, with one setting. It works next to WordPress." | SPEC §5 *DNS only at launch* (`docs/SPEC.md:255`) |
| "Do I have to approve every page?" | "No. Each page goes live by itself after a waiting time. You can edit or stop it first, or do nothing." | `landing.plan.control.line`, `landing.ts:67` |
| "Can I get a refund?" | "You see everything before you pay, so there are no refunds. Cancel any time and you're not charged again. Every page can be downloaded." | D2; `report.ts:679`; `settings.content.export`, `settings.ts:771` |
| "My site is in German" | "Sites in Germany, Austria and Switzerland get pages in German. The dashboard and emails are in English." | `landing.faq.german.short`, `report.ts:680`; `icp-and-sources.md` |
