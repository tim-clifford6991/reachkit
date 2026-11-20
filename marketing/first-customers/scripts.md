# R4: Outreach scripts (EN)

**Audience:** owners in `icp-and-sources.md` scoring 6 or more. **Message:** "AI answers send your
buyers to someone else, and you can see it free." **Call to action:** run the free scan on your own
domain. One ask per message. English only: the first 50 are English-speaking businesses (D10).

## Owner to do

- [ ] Edit every script into your own voice before the first send (they are drafts).
- [ ] Make the booking link (R7) and paste it where `{booking}` stands.
- [ ] No cold email for now (D11). The researched leads get a LinkedIn connection and a message.
- [ ] Anyone who says no: write the date in `opted_out_on` in the private tracker, and never write
      again.
- [ ] You send every message yourself. Nothing here is sent by an agent.

## Rules for every message

| Rule | Why |
|---|---|
| Link the scan with the channel tag: `https://reachkit.app/?ref={channel}` (README › Channel links) | D7. The landing stores the tag with the scan (#2692); a purchase from `/pricing` reads none, so also ask "where did you hear of us?" and write it in `heard_from` |
| Never scan their site for them; they run it | Every scan is a public card on `/scans` (SPEC §2 *Gallery lists every report*, `docs/SPEC.md:162`) |
| Say "up to 7 pages a week, new or updated", never "a page a day" | SPEC §1 *The pace* (`docs/SPEC.md:94`); `offer.cadence.page` (`src/lib/presentation/copy/keys/offer.ts:36`) |
| No refund line in a post or on a page; only in a one-to-one message or call. The setup promise may be said anywhere, in its own words | README rule 1; D2 (lifted 2026-11-20, #2981) |
| Say "first 50 customers" and "spots". Name one pool and one end date | README › *Customer words*; D4 (replaced 2026-11-20) |
| Name no rival product; a prospect's own rivals from their own report are fine | `offer.md` |
| No promised ranking, mention or result | `landing.faq.results.short` (`report.ts:677`): "Google takes weeks to months" |
| Stop after the day-7 follow-up | Playbook §2 |

Placeholders: `{name}`, `{company}`, `{domain}`, `{category}` (their market in plain words),
`{rival A}`, `{rival B}`, `{exact question}`, `{signal}`, `{left}`, `{booking}`, `{channel}`.

`{left}` is the number the site shows (the banner, from `/offer/spots`). Until that ships: 50 minus every first paid checkout not refunded within 14 days, owner and test accounts excluded. The offer
ends at the end of **31 Jan 2027** UTC, or sooner when all 50 spots are taken (D4).

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

## 2. Cold signal opener (LinkedIn)

**Channel:** LinkedIn only: a connection request with the note, then the message once they accept.
No cold email for now (D11). The researched leads in the private tracker go this way.
**Before sending:** ask ChatGPT, Perplexity or Google AI the `{exact question}` by hand and record
the answer in `leads.csv` (`ai_answer_gap`), with a dated screenshot: AI answers change, and the
note must match what you saw. Never run a ReachKit scan of their site.

**Connection note (under 300 characters):**

> Hi {name}, I asked ChatGPT "{exact question}". It named {rival A} and {rival B}, not {company},
> even with your {signal}. I built a free scan that shows where AI sends your buyers. Happy to share.

**Message, once they accept:**

> Thanks for connecting, {name}. Here's the scan I mentioned. It shows which businesses Google and
> AI answers send your buyers to, and the questions your buyers ask that no page of yours answers.
> It's free and needs no signup: https://reachkit.app/?ref=linkedin
>
> Worth a look?

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
> your own site and published there. Each Monday an email shows what went live and your totals so far.
>
> I'm setting up the first 50 customers personally. It's set up in about 10 minutes, or I do it
> with you on a call. You also get a check-in after two weeks and after a month, and you can email
> me directly. €49 a month, VAT included, cancel any time.
>
> {left} of 50 spots left until 31 Jan 2027. Book 15 minutes: {booking}. Or start straight from
> your report:
> https://reachkit.app/scan/{domain}

Evidence: pace (`offer.ts:36`), facts from their site (`setup.business.assurance`,
`setup.ts:456`), Monday email (`offer.cadence.movement`, `offer.ts:37`), €49 VAT included
(`landing.plan.terms`, `landing.ts:69`), cancel any time (`landing.faq.stop.short`,
`report.ts:678`), about 10 minutes (`setup.step.time`, `setup.ts:396`). The first-50 extras, the
setup call and the spots are the owner's (D2, D4), not product features. No price-lock line until
Terms §4 carries it (#2993). After they pay, confirm the terms in a plain mail by hand
(`setup-call.md` › After the call; trust-compliance F7).

**If they ask "what if it doesn't work?"** (the refund line is one to one only, never in a post;
D2; F7 wording):

> You read your report and a first page before you pay. Payments aren't refunded unless the law
> requires it. Setup takes about 10 minutes, and if it takes longer, we do it together on a call.
> Each page goes live on its day, by itself, once your site is connected. Google takes weeks to
> months; each Monday email shows your totals so far.

Evidence: the free page (`landing.faq.trial.a`, `report.ts:674`); refunds are Terms §4
(`legal.terms.body`, `chrome.ts:197`); about 10 minutes (`setup.ts:396`); each page on its day is
`setup.connect.week.2` (`setup.ts:600`, SPEC §5 Connect); the rest of the results line is
`landing.faq.results.short` (`report.ts:677`).

## 4. Follow-up, day 3 (no reply)

**Goal:** a reply. One new thing, no guilt.

To a no-reply on the opener:

> Hi {name}, one more thing I noticed: {one concrete finding from asking AI by hand, e.g. "for
> 'best {category} in {city}', Google's AI quotes {rival A}'s pricing page"}. The free scan shows
> the whole picture for {domain}: https://reachkit.app/?ref={channel}

To a no-reply after the walkthrough:

> Hi {name}, did the walkthrough make sense? Happy to answer anything in a reply here, no call
> needed. {left} of 50 spots left until 31 Jan 2027.

Only say the spots left if the number is the real count from the Progress table.

## 5. Follow-up, day 7 (last)

**Goal:** a clean close. After this, stop.

> Hi {name}, I'll leave it here so I'm not cluttering your inbox. If you want to see who AI sends
> your buyers to, the scan stays free: https://reachkit.app/?ref={channel}. Good luck with
> {specific thing}.

After a walkthrough:

> Hi {name}, last note from me. The offer for the first 50 customers ends on 31 Jan 2027, and
> {left} spots are left. If the timing's wrong, no problem: your report stays at
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
| "Too expensive" | "Compare it with what one page costs. In one survey of 213 freelance writers, from about 2021, the most common rate for a 1,500-word post was $250–399. This is €49 a month for up to 7 pages a week, written by AI from your own site." | `price-anchors.md` A1 (F5 wording) |
| "I'll think about it" | "Sure. What would you need to see? There are {left} of 50 spots left until 31 Jan 2027." | D4 (replaced 2026-11-20); trust-compliance F6: say only the real count |
| "SEO didn't work before" | "You've seen the report before paying. And every Monday the email shows your totals so far, so you're never guessing." | `offer.ts:37` |
| "I can do it with ChatGPT" | "You can. The question is whether you'll research, write, check and publish up to 7 pages every week." | `offer.ts:36` |
| "Is this AI spam?" | "No. Claude, an AI model, writes each page from your site and linked sources. A page that fails its checks twice never goes live." | `landing.faq.spam.a`, `report.ts:658` |
| "Will Google penalise AI pages?" | "No. Google has said that using AI to write pages isn't against its rules. What it acts on is pages churned out in bulk just to game search, with nothing new in them, however they were written. ReachKit writes each page from facts on your own site and linked public sources. It holds back any page with an invented fact or one that repeats a page you already have. And it only writes a new page when it has something the top results don't already say." Then send the written answer (§7). | seo-master on #2693; §7 |
| "I'm not technical" | "It's set up in about 10 minutes, and we can do it together on this call. It's one setting where you bought your web address." | `landing.faq.start.a`, `report.ts:667` |
| "I'm on WordPress" | "Not among the first 50. I'm starting with sites that connect by subdomain. Can I come back to you later?" | Owner D8, widened to all 50 on #2698; WordPress publishing is off on production (SPEC §5 *DNS only at launch*, `docs/SPEC.md:255`) |
| "Do I have to approve every page?" | "No. Each page goes live by itself after a waiting time. You can edit or stop it first, or do nothing." | `landing.plan.control.line`, `landing.ts:67` |
| "Can I get a refund?" | "You read your report and a first page before you pay. Payments aren't refunded unless the law requires it. Cancel any time and you're not charged again. Every page can be downloaded." | D2; Terms §4 (`chrome.ts:197`); `report.ts:678`; `settings.content.export`, `settings.ts:769` |
| "My site is in German" | "Sites in Germany, Austria and Switzerland get pages in German. The dashboard and emails are in English." | `landing.faq.german.short`, `report.ts:680`; `icp-and-sources.md` |

## 7. "Will Google penalise AI pages?": the written answer

seo-master's approved answer (#2693). Send it after the call, as the script promises, or as a
reply to someone who asked. One to one, or as a reply in public; it promises no result.

**EN (send as written, in your voice):**

> Straight answer: no, not for being written with AI. Google's own guidance says appropriate use of
> AI isn't against its rules. What breaks its rules is publishing lots of pages mainly to
> manipulate rankings, with little value for readers, whether a person or a machine wrote them.
>
> How ReachKit stays on the right side of that:
> - Every fact on a page comes from your own site or a public page it links, with its address.
> - A page with an invented fact, figure or testimonial doesn't go live.
> - A new page is written only when it adds facts the top results don't already have. Otherwise
>   ReachKit updates one of your pages or skips the day.
> - A page that repeats one you already have doesn't go live.
> - You can read, edit or stop any page before it goes live. You don't have to.
>
> Nobody can promise a ranking, and I won't. Google's guidance:
> https://developers.google.com/search/docs/fundamentals/using-gen-ai-content

**Held bullet:** "Each page carries your byline and a line saying it was written with AI from your
site's facts." Not true of every page today: a page with no fact from the site, and some older
pages, carry no AI note (seo-master on #2693; 2 of 13 articles on our own `content.reachkit.app`).
Add it back only when #1127 lands with the note on every published page.

**DE (draft, not used for the first 50: the German push is dropped, D10; kept for later):**

> „Nein. Google sagt selbst, dass KI beim Schreiben nicht gegen seine Regeln verstößt. Google geht
> gegen Seiten vor, die massenhaft und ohne Mehrwert erstellt werden, nur um die Suche
> auszutricksen, egal wer sie schreibt. ReachKit schreibt jede Seite aus Fakten Ihrer eigenen
> Website und verlinkten öffentlichen Quellen. Eine Seite mit einer erfundenen Angabe oder eine, die
> eine bestehende Seite wiederholt, geht nicht live. Und eine neue Seite entsteht nur, wenn sie
> etwas sagt, was die Top-Ergebnisse noch nicht sagen."

**Never say:** "Google can't detect AI"; "Google rewards AI content"; "guaranteed safe" or "no
penalty"; "a person checks every page"; any typed count of rules or checks.

Evidence: Google Search Central, "Google Search and AI content" (2023-02-08,
https://developers.google.com/search/blog/2023/02/google-search-and-ai-content); spam policies,
scaled content abuse (https://developers.google.com/search/docs/essentials/spam-policies); SPEC §7
*Two pools of facts*, *Only a harm check stops a page*, *A new page adds what the web does not say*
(`ADDS.min`, `src/lib/config/constants/generate.ts:333`); the customer's edit and stop
(`landing.plan.control.line`, `landing.ts:67`).
