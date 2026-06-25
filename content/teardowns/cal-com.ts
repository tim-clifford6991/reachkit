import type { Teardown } from "./types";

/**
 * Cal.com — Web Discoverability Teardown
 *
 * Score band: 30–50 (rubric); assigned 44 (developing tier — strong open-source
 * brand and category authority, but discoverability strategy chases the
 * "Calendly alternative" comparison query while under-serving the
 * white-label / embedded-scheduling platform audience it uniquely serves).
 */
const calCom: Teardown = {
  slug: "cal-com",
  appName: "Cal.com",
  title: "Web Teardown: Cal.com",
  platform: "web",
  publishedAt: "2026-06-05",
  lastVerified: "2026-06-19",
  blurb:
    "Cal.com is positioned as the open-source Calendly alternative — a frame that traps it in a feature-for-feature comparison it will always partly lose on polish. Its genuinely uncontested audience is developers embedding scheduling into their own product, and that story is buried.",
  score: {
    total: 44,
    breakdown: {
      content: 47,
      outreach: 42,
      seo: 43,
    },
  },
  intro:
    "Cal.com has real assets: a beloved open-source codebase, an active developer following, and enough category authority to rank for serious scheduling terms. The discoverability weakness is positional. By framing itself first as 'the open-source Calendly alternative', Cal.com volunteers for a head-to-head comparison on a query where the incumbent has spent a decade polishing the consumer experience. That frame wins the ideologically-motivated open-source switcher, but it understates the thing Cal.com can do that Calendly fundamentally cannot: be embedded, white-labelled, and self-hosted inside someone else's product. The platform audience is the most defensible one, and the homepage leads with the comparison instead.",
  sections: [
    {
      heading: "What does Cal.com do differently from Calendly?",
      body: [
        "Cal.com is open-source scheduling infrastructure. At the surface it covers the familiar territory — booking pages, availability rules, calendar sync, round-robin team scheduling — and matches Calendly feature-for-feature on the basics. The difference is underneath: the codebase is open, self-hostable, API-first, and designed to be embedded into other applications rather than only used as a standalone booking link.",
        "That embeddability is the real differentiator. A company can drop Cal.com's scheduling into its own product, white-label it entirely, control the data, and self-host for compliance — none of which Calendly is built to allow. For a SaaS team that needs scheduling as a feature inside their app, Cal.com is not a Calendly competitor at all; it is closer to a Stripe-shaped building block. That is a different product category with a different, stickier buyer.",
        "Competitors map cleanly. Calendly owns the consumer and SMB standalone-link market with superior polish and brand recognition. Acuity owns the appointment-based service businesses. SavvyCal courts the power-scheduler niche. None of them seriously compete for the embed-and-white-label platform use case — which is the lane where Cal.com has almost no direct rival and the strongest moat.",
      ],
    },
    {
      heading: "Who is Cal.com's highest-intent audience?",
      body: [
        "The obvious ICP is 'people who want a free, open-source Calendly'. That audience exists and converts, but it is price-sensitive, self-hosts the free tier, and is partly motivated by ideology rather than budget. It is not where the durable revenue lives. The highest-intent buyer is the developer or product team that needs to build scheduling into their own application and would otherwise have to engineer it from scratch.",
        "The specific profile: a marketplace, a healthcare or services platform, a recruiting tool, or any SaaS where booking is a core in-app workflow rather than a link in an email signature. This team has evaluated the cost of building calendar logic themselves — timezones, availability collisions, calendar-provider sync — and concluded it is a quarter of engineering they would rather not spend. For them Cal.com Platform is a buy-versus-build decision worth real money.",
        "This audience converts on different evidence than the standalone-link switcher. The switcher wants to see a prettier booking page than Calendly. The platform buyer wants to see clean API docs, an embeddable component, predictable pricing per booking, and proof that other products have shipped on it. They are reading documentation, not comparison tables — and Cal.com's documentation-quality story is one of its strongest, least-marketed assets.",
      ],
    },
    {
      heading: "Where is Cal.com's audience searching?",
      body: [
        "The flagship query 'calendly alternative' (around 9,900/mo) is high-volume and commercially obvious, but it is a comparison query that recruits exactly the price-sensitive switcher and forces Cal.com onto Calendly's terms. Cal.com already ranks here; pushing harder mostly deepens the wrong positioning. The platform clusters are where the under-served, higher-value intent sits.",
        "The builder cluster is the undervalued one: 'scheduling API' (1,300/mo), 'embed scheduling in app' (720/mo), 'open source scheduling' (2,400/mo), and 'self-hosted booking system' (880/mo). Volumes are lower, but each searcher is a developer with a buy-versus-build problem and budget authority, and the queries are far less contested because Calendly and Acuity do not credibly compete for them. A buyer typing 'scheduling API' is not shopping for a booking link.",
        "For outreach, the strongest channels are developer-native rather than productivity-roundup. Cal.com's open-source story plays naturally in developer communities — Hacker News, dev-tooling newsletters, the API-and-infrastructure corners of Reddit and Discord — and on directories like the open-source alternatives lists where it already earns goodwill. These are the rooms where 'embeddable, self-hostable, API-first' is a selling point rather than jargon.",
      ],
    },
    {
      heading: "What should Cal.com prioritise to improve its discoverability score?",
      body: [
        "The highest-leverage move is to give Cal.com Platform its own front door rather than treating it as a sub-page beneath the Calendly comparison. A dedicated 'Scheduling infrastructure for your app' landing page, optimised for 'scheduling API' (1,300/mo) and 'embed scheduling in app' (720/mo), speaks to a developer with budget instead of a switcher hunting for free. This is the page that reframes Cal.com from 'cheaper Calendly' to 'the scheduling layer you build on'.",
        "For content, a builder-focused explainer — 'how to add scheduling to your SaaS without building a calendar engine' — captures the exact buy-versus-build moment and routes naturally to the Platform product. It also doubles as developer-marketing collateral that earns links from the technical communities Cal.com is already trusted in.",
        "On outreach, Cal.com should keep investing where it is already credible: developer communities, open-source directories, and dev-tooling newsletters, with the embed-and-API story foregrounded rather than the Calendly comparison. A well-placed technical post about the hard parts of timezone-correct scheduling demonstrates the moat better than any feature table and reaches the platform buyer at their level.",
        "Finally, the homepage can afford to lead with the platform promise alongside, not behind, the open-source-Calendly hook. Keeping the comparison wins the switcher; adding 'scheduling infrastructure you can embed and self-host' wins the buyer who has money and a problem Calendly cannot solve at all. Speaking to both, with the higher-value audience visible above the fold, is the cheapest score improvement available.",
      ],
    },
  ],
  takeaways: [
    "Stop letting 'calendly alternative' (9,900/mo) define the positioning — it recruits the price-sensitive switcher and forces a comparison on the incumbent's terms.",
    "Give Cal.com Platform a dedicated landing page targeting 'scheduling API' (1,300/mo) and 'embed scheduling in app' (720/mo) — low-contest queries with real budget behind them.",
    "Publish a 'how to add scheduling to your SaaS without building a calendar engine' explainer to capture the buy-versus-build moment and earn developer-community links.",
    "Concentrate outreach in developer-native channels where 'embeddable, self-hostable, API-first' is a selling point, not jargon.",
    "Surface the platform promise above the fold alongside the open-source-Calendly hook so the high-value embed buyer sees their use case, not just the switcher.",
  ],
};

export default calCom;
