<!--
  ========================================================================
  DRAFT — for Tim to finalize. Not final copy.
  ========================================================================
  Cycle 5 · Task 14 (Milestone F) launch asset.

  This is a STARTING POINT for the Show HN post, not the post itself. HN
  rewards a specific, honest, technical, slightly-underselling voice and
  punishes anything that reads like marketing. Read it out loud, cut a third,
  and make it sound like *you* before posting.

  Strategy (spec §3): Show HN the FREE SCAN, not the paid product. The ask is
  "try this and tell me where it's wrong / useless," not "buy my thing." Pricing
  is mentioned once, plainly, and only because hiding it reads as evasive.

  Posting notes for Tim:
  - Pick ONE title from the options below. Keep it concrete; resist hype words.
  - Post the body as the FIRST comment immediately after submitting (HN norm),
    not in the URL field. URL = the live scan tool (a no-signup entry point if
    one exists; otherwise the landing page that starts a scan).
  - Be in the thread for the first 3–4 hours. Reply to every comment. Answer
    "how is this different from {ASO tool}" and "what data are you actually
    using" directly — those will come up.
  - Things to be ready to defend honestly: data sources & TOS (DataForSEO +
    Tavily + official free APIs; no scraping you can't stand behind), what's
    deterministic vs LLM-generated, false-positive rate, and the obvious "isn't
    this just SEO advice an LLM could give me" objection.
  - Do NOT vote-ring or ask for upvotes. It's against the rules and HN detects it.
  ========================================================================
-->

# Show HN — draft

## Title options (pick one)

1. **Show HN: A tool that tells solo founders exactly how to get their app found**
2. **Show HN: Paste your App Store URL, get a discoverability score and 3 fixes**
3. **Show HN: I built the marketing co-founder I couldn't afford**
4. **Show HN: Free scan that finds why nobody can discover your app or SaaS**

> Recommendation: (1) matches the spec's framing and is concrete without hype.
> (2) is the most "shows the thing" and tends to do well on HN. (3) is more
> personal/story-driven — higher variance, can read as fluffy. Test (1) or (2).

---

## Body (first comment)

I'm a solo developer. I've shipped things, gotten them to a few hundred users
or a few hundred dollars in MRR, and then completely stalled — because building
the product and *getting it found* are different jobs, and I'm only good at one
of them. Every time I hit that wall I'd end up with 14 browser tabs open (ASO
blog posts, a keyword tool trial, an "submit to 100 directories" listicle, a
Reddit thread of conflicting advice) and no actual plan.

So I built the thing I kept wishing existed: you paste your App Store URL or
your website, and it tells you, specifically, why your product is hard to
discover and what to do about it this week.

How it works:

- **Free scan.** Paste a URL (no signup to start). In ~10 seconds it shows
  it's actually working — pulling your reviews, finding your real competitors,
  crawling your site. In ~2 minutes you get a Discoverability Score (0–100), a
  "positioning mirror" (here's what your product *appears* to say it does, in
  your customers' words from your reviews — this part tends to sting), and three
  concrete findings.
- **Full report (email-gated, still free).** ICP breakdown, a competitor gap
  map, and a prioritized action plan across content, outreach, and SEO/ASO —
  each action with the evidence behind it, an effort estimate, and a rough draft
  you can edit, not a vague "you should do content marketing."

The part I care most about getting right is that it's **evidence-first**. Every
finding points at the thing it's reading — a specific review, a keyword your
competitor ranks for and you don't, a comparison page that doesn't exist yet.
The score moves only on verified components, so it's not a vanity number.

On the data, since this is HN and that's the first question: the backbone is
DataForSEO (SERP, keyword volumes, App Store keyword search) and Tavily for web
research, plus the official free APIs (iTunes Search, Product Hunt's API, etc.).
I deliberately avoided the gray-area scraping that this kind of tool usually
leans on — I'd rather have a narrower honest dataset than a broad one I can't
defend. The scoring and the "what's wrong" detection are deterministic; the
*drafts* and some of the phrasing are LLM-generated, and I've tried to keep a
hard line between "this is a measured fact" and "this is a generated suggestion."

What I'd genuinely love from you:

- **Run it on your own app/SaaS and tell me where it's wrong.** Wrong
  competitor? Score that doesn't match reality? A "finding" that's obvious or
  useless? That feedback is worth more to me than a signup.
- Is the positioning mirror accurate or does it misread your product?
- If you've tried the existing ASO/SEO tools — what do they get right that this
  is missing?

It's free to scan and free to get the full report. There's a paid tier later
($29/mo) that turns it into a weekly operating system — a fresh action queue,
monitoring, and verification that the things you did actually went live — but
that's not what I'm asking you to look at today. I want to know if the free
scan tells you something true and useful about your own product.

Link is up top. I'll be here in the thread all day — fire away, including the
skeptical stuff.

---

## Likely objections + honest replies (prep, not for posting verbatim)

- **"Isn't this just generic SEO advice an LLM could give me?"**
  The advice is generated, but it's *grounded* in your actual data — your
  reviews, your real competitors' keyword gaps, what comparison pages exist for
  your category. The value isn't the LLM; it's the pipeline that gathers the
  evidence the LLM reasons over. Happy to show a before/after on a real app.

- **"How is this different from AppFigures / Astro / {ASO tool}?"**
  Those do ASO keywords well. ASO is one slice of this — it also covers content,
  outreach, web SEO, directories, and AI-answer presence, and it gives you a
  prioritized weekly plan instead of a dashboard you have to interpret.

- **"What about web SaaS, not just apps?"**
  Both are first-class. Paste a website and it runs the web pipeline (SERP
  "alternatives to {you}", comparison gaps, directory coverage) instead of the
  App Store one.

- **"Pre-launch / no reviews yet?"**
  There's a cold-start path that leans on competitors and category signal
  instead of your (nonexistent) reviews, and it labels its output as
  lower-confidence rather than pretending.

- **"Data/TOS?"**
  Covered above — DataForSEO + Tavily + official free APIs; no scraping I can't
  stand behind. Ask for specifics and I'll answer.
