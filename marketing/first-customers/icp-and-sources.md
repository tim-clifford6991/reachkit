# Who the first 50 are, and where to find them

## Criteria: Hormozi's starving crowd

A market worth selling to has pain, purchasing power, is easy to target and is growing. Applied to
ReachKit, plus the two tests our product adds (can they set it up, will they be a case study):

| Test | Must have | Strong signal | Disqualify |
|---|---|---|---|
| Pain | Gets customers from search and knows it | Rivals are named in ChatGPT or Google answers and they are not; complains about "not being on Google"; stale blog | All work from referrals, no wish to be found |
| Purchasing power | Pays €49 a month by card without asking anyone | Already pays for software, ads or a freelancer | Hobby site, no-budget nonprofit, pre-launch with nothing to sell |
| Easy to target | The decider is the founder or owner | You know them or someone who does; active on LinkedIn or X | A marketing team, an agency or enterprise buying in the way |
| Growing | Their category is asked about in AI answers | New or crowded category, recent launch, hiring | Dying category, winding down |
| Can set it up | Controls DNS for their domain, so a subdomain can point at us | Built the site themselves or has a technical cofounder | Locked site builder with no DNS or subdomain access; **wave 1: a WordPress-run site scores 0 (D8)** |
| Case study | Will share before and after | Has an audience: a newsletter, posts in public | Wants to stay anonymous (fine as a customer) |

**Score** pain, purchasing power, easy to target, can set it up and case study at 0, 1 or 2 each.
Contact 8–10 first, 6–7 second, below 6 not in the first 50. In wave 1 a WordPress-run site scores 0
on "can set it up" and is not pitched (owner D8, 2026-11-15).

**Segment order** (reach per owner-hour, from the growth plan):

1. Owner-run SaaS, software and online businesses (EN)
2. Consultants, accountants, coaches and small agencies (many on WordPress: not in wave 1, D8)
3. Local services, shops and hospitality, reached directly (the route through the web designer
   who runs their site is deferred to Phase 2, D6)
4. German businesses (DE, AT, CH), from week 5. Pages are written in German; the dashboard and
   mails are English, and the material says so.
   Reached in person, by post, through public posts people answer, or when they ask first, never
   by an unasked email, LinkedIn, WhatsApp or SMS message (README rule 3), and only after the
   wave-3 prerequisites in `playbook.md` hold (G7).

UK sole traders and partnerships (common in segments 2 and 3) get no cold message either; a UK
business is cold-mailed only when Companies House shows a company, LLP or Scottish partnership
(`entity_type` = `company` in the tracker, README rule 3).

## Where to find them: the Core Four

Hormozi's order: warm outreach first, then content, then cold outreach, paid ads last. Volume
every day, the Rule of 100: 100 outreach actions a day (or 100 minutes of content).

### 1. Warm outreach: the first 20–30

| Source | How to pull it |
|---|---|
| Phone contacts, WhatsApp, Gmail | Export, tag everyone who owns a business website |
| LinkedIn 1st-degree connections | Settings → Data privacy → Get a copy of your data → Connections. Filter titles: Founder, Owner, CEO, Managing Director, Inhaber, Geschäftsführer. A connection is not consent: in Germany and Austria, and to UK sole traders and partnerships, no sales message unless they asked first (README rule 3; D9 for personal friends) |
| Former colleagues and clients | Anyone who left to start something |
| Referral ask (a lead getter) | "Who do you know who owns a business website and hates marketing?" |

The message is **ACA**: acknowledge, compliment, ask. No pitch in the first message; the free scan
is offered as a gift.

### 2. Cold sources with the right signal

| Source | Signal | How |
|---|---|---|
| Ask ChatGPT, Perplexity or Google AI about a category ("best bookkeeping software for freelancers", "best physio in Leeds") | Businesses that rank on Google or Maps but are not in the AI answer: the pain, proven | By hand, recorded in `leads.csv`. Never a ReachKit scan of their site (it would be a public card) |
| Product Hunt, Indie Hackers, BetaList, r/SaaS "share your project" threads | Launched 3–18 months ago, solo or small team | Maker profiles link X and LinkedIn |
| LinkedIn Sales Navigator (free trial) | Company size 1–10, title Founder or Owner, posted in the last 30 days | Saved searches → connection note: the signal note to US businesses and UK companies only; everyone else no note or the no-offer note (`scripts.md` §2, README rule 3) |
| BuiltWith or Wappalyzer | WordPress, small business, last blog post over 6 months ago | Lists or the browser extension |
| Google Maps by category and city | 4.5★+, 50+ reviews, weak site: good but hard to find | By hand (the Places API is spend: owner's go) |
| G2, Capterra, Shopify App Store, WordPress plugin directory | Small vendors with few reviews in crowded categories | Vendor page → site → founder |
| ~~Web designer and agency directories (Clutch, Dribbble, Webflow and WordPress expert lists)~~ | ~~Agencies of 1–5 running 10+ small-business sites~~ | Deferred to Phase 2 (D6): no partner channel in the first 50 |
| IHK Berlin, BNI chapters, coworking Slacks, founder WhatsApp groups | Members are owners | Attend, give value, ask for introductions |

### 3. Content: the lead magnet already exists

The free scan solves a narrow problem (where do AI answers send my buyers?) and reveals the bigger
one (I am not there, and I have no time to write my way in). Each post carries one finding, from
our own report or from aggregate figures under the conditions in README › *Aggregate figures across
stored scans* (trust-compliance F9), and one ask: run yours free.

### 4. Paid ads: last

Only after 10 paying. The €150 Google Search test with its stop rule is in the growth plan
(2026-11-11) and needs the owner's go.

## The numbers (assumptions, replace with actuals in the README's Progress table)

About 1,000 outreach actions → about 300 replies → about 150 scans → about 50 paying. That needs
roughly one in three scans to buy, which only the hand-held Founding offer makes plausible. At the
Rule of 100 it is about 10 working days of outreach, spread over the waves in `playbook.md`.
