/**
 * Curated directory checklist — §6 module 5 (SEO & Discoverability).
 *
 * A hand-curated list of ~40 real, reputable app/SaaS submission directories
 * that solo founders of consumer subscription products should be listed on.
 * This is the canonical source for two surfaces:
 *
 *   1. SEO/ASO action cards (§6 module 5): "Submit to these 5 directories this
 *      week (links + prefilled blurbs)." The weekly queue draws unlisted, high-
 *      and mid-tier directories (filtered by the app's platform) into action
 *      cards; "directories live" is then verified via verify_url (§6 tracking)
 *      and feeds the SEO subscore (§7.3: directories live = 20% of the axis).
 *   2. A future public `/tools` page (a free, linkable directory checklist —
 *      GEO/share-loop bait, same content-as-data pattern as content/teardowns/*).
 *
 * Scoring note (§7 component 4): only directories at or above the curated-list
 * threshold count toward the Score. Everything in this list is curated and
 * counts; `domainAuthorityTier` lets the queue *prioritise* (high → mid →
 * niche) rather than gate. Genuinely low-authority directories are simply not
 * in this list, so a listing there contributes zero by construction.
 *
 * Curation rules:
 *   - Real, live, reputable directories only — no link farms, no pay-to-rank
 *     schemes, no dead properties. URLs are submission/listing entry points.
 *   - Mix of app-store-adjacent (ASO) and SaaS/web (SEO) so the list serves
 *     both halves of the ICP (mobile apps + web SaaS).
 *   - `domainAuthorityTier` is a coarse, deliberately stable bucket (high /
 *     mid / niche) — NOT a precise DA number (those drift and we don't want to
 *     ship a number that rots). Treat it as relative leverage, not a metric.
 *   - `platforms` says where a listing is *useful*, not merely accepted. Many
 *     directories technically accept anything; we tag the platforms a founder
 *     actually benefits from listing under.
 *
 * Maintenance: this is content, reviewed like the teardowns. Add/curate by
 * editing `curatedDirectories` directly. Keep entries accurate over exhaustive.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Platforms a directory listing is genuinely useful for. */
export type DirectoryPlatform = "ios" | "android" | "web";

/**
 * Coarse domain-authority bucket used to *prioritise* the weekly queue.
 * Not a precise DA score (those drift); relative leverage only.
 *
 * - `high`   — flagship destinations; meaningful referral + ranking weight.
 * - `mid`    — solid, well-trafficked; reliable second-wave submissions.
 * - `niche`  — narrower reach but high-intent / category-relevant audiences.
 */
export type DomainAuthorityTier = "high" | "mid" | "niche";

/** One submission directory in the curated checklist. */
export interface Directory {
  /** Directory / property name as users know it. */
  name: string;
  /** Absolute https submission or listing entry-point URL. */
  url: string;
  /** Coarse grouping for display + filtering (e.g. "App stores", "SaaS"). */
  category: string;
  /** Relative leverage bucket (see DomainAuthorityTier). */
  domainAuthorityTier: DomainAuthorityTier;
  /** Platforms a listing here is genuinely useful for (non-empty). */
  platforms: DirectoryPlatform[];
  /** One-line, honest note: what it is, why list, any catch. */
  notes: string;
}

// ---------------------------------------------------------------------------
// The curated list (~40)
// ---------------------------------------------------------------------------

/**
 * The curated directory checklist. Ordered roughly by leverage within category
 * groupings so the top of the list reads as a sane "start here" sequence.
 */
export const curatedDirectories: readonly Directory[] = [
  // --- Launch platforms (the marquee day-one destinations) -----------------
  {
    name: "Product Hunt",
    url: "https://www.producthunt.com/posts/new",
    category: "Launch platforms",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "The default launch destination. A live listing is a permanent DA-90 backlink and an evergreen review surface; plan the launch day, but the page keeps working long after.",
  },
  {
    name: "Hacker News (Show HN)",
    url: "https://news.ycombinator.com/showhn.html",
    category: "Launch platforms",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Not a directory but the single highest-leverage launch surface for technical founders. Show HN the free tool, not the paid product. One shot; make the title earn the click.",
  },
  {
    name: "BetaList",
    url: "https://betalist.com/submit",
    category: "Launch platforms",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Early-stage/pre-launch startups. Good for collecting an early-adopter waitlist before a Product Hunt day. Free with a queue; paid skip-the-line option.",
  },
  {
    name: "Uneed",
    url: "https://www.uneed.best/submit-a-tool",
    category: "Launch platforms",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Product Hunt-style daily tool launches with a friendlier indie audience. Free submission with a queue; a low-cost way to get a second launch spike.",
  },
  {
    name: "Peerlist Launchpad",
    url: "https://peerlist.io/launchpad",
    category: "Launch platforms",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Weekly product launch board with an engaged maker/developer audience. Free; a solid complementary launch to Product Hunt for technical products.",
  },
  {
    name: "Launching Next",
    url: "https://www.launchingnext.com/submit/",
    category: "Launch platforms",
    domainAuthorityTier: "niche",
    platforms: ["web"],
    notes:
      "Long-running directory of new startups. Low effort, free tier (paid is faster). Modest traffic but a clean, relevant backlink.",
  },

  // --- Alternatives & comparison directories (high buyer intent) -----------
  {
    name: "AlternativeTo",
    url: "https://alternativeto.net/manage/suggest-app/",
    category: "Alternatives & comparison",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "Captures users searching 'alternatives to {competitor}' — peak comparison intent. List yourself as an alternative to the incumbents your reviews mention. DA-80 backlink.",
  },
  {
    name: "Slant",
    url: "https://www.slant.co/",
    category: "Alternatives & comparison",
    domainAuthorityTier: "mid",
    platforms: ["ios", "android", "web"],
    notes:
      "Crowd-ranked 'what is the best X?' lists. Add your product as an option on the questions your category owns; high-intent, evergreen, and well-indexed.",
  },
  {
    name: "Product Hunt Alternatives",
    url: "https://www.producthunt.com/alternatives",
    category: "Alternatives & comparison",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "Auto-generated alternative pages off your Product Hunt listing. Free leverage once you've launched: another comparison-intent surface with no extra submission.",
  },

  // --- SaaS directories (web SEO) ------------------------------------------
  {
    name: "G2",
    url: "https://www.g2.com/products/new",
    category: "SaaS directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "The dominant B2B/SaaS review platform. Ranks for '{category} software' and 'best {category} tools'. Claim the profile early; the review flywheel and DA-90 backlink compound.",
  },
  {
    name: "Capterra",
    url: "https://www.capterra.com/vendors/sign-up",
    category: "SaaS directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Gartner-owned software directory with massive buyer-intent traffic. Free listing; ranks strongly for category queries. Pairs with GetApp/Software Advice (same network).",
  },
  {
    name: "GetApp",
    url: "https://www.getapp.com/",
    category: "SaaS directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Part of the Gartner Digital Markets network (with Capterra/Software Advice). A single vendor sign-up often syndicates across all three; high DA and category ranking.",
  },
  {
    name: "SaaSHub",
    url: "https://www.saashub.com/",
    category: "SaaS directories",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Popular software-alternatives directory. Free listing, comparison-intent traffic, and a clean backlink. A reliable early submission for any web SaaS.",
  },
  {
    name: "SaaSworthy",
    url: "https://www.saasworthy.com/",
    category: "SaaS directories",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Software discovery and comparison directory with category rankings. Free listing; decent buyer-intent traffic and a category-relevant backlink.",
  },
  {
    name: "Crozdesk",
    url: "https://crozdesk.com/vendors",
    category: "SaaS directories",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Software discovery directory with a ranking algorithm. Free vendor listing; useful for category coverage and an additional comparison surface.",
  },
  {
    name: "SourceForge",
    url: "https://sourceforge.net/software/vendors/new/",
    category: "SaaS directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Beyond OSS — now a high-DA business-software directory and review site. Free listing ranks well for category and comparison queries; underused by indie founders.",
  },
  {
    name: "Software Advice",
    url: "https://www.softwareadvice.com/",
    category: "SaaS directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Third property in the Gartner Digital Markets network. Often populated via the same Capterra/GetApp vendor sign-up; high authority and strong category SERP presence.",
  },

  // --- Indie / maker communities -------------------------------------------
  {
    name: "Indie Hackers Products",
    url: "https://www.indiehackers.com/products",
    category: "Indie & maker communities",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "Exactly the ICP — solo and bootstrapped founders. A product profile plus genuine participation (milestones, posts) does more than the listing alone. High DA backlink.",
  },
  {
    name: "Startup Stash",
    url: "https://startupstash.com/submit-resource/",
    category: "Indie & maker communities",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Heavily-trafficked curated directory of startup tools and resources. Free submission with a queue (paid is faster). Long-lived backlink and steady referral trickle.",
  },
  {
    name: "SaaS Genius",
    url: "https://www.saasgenius.com/",
    category: "Indie & maker communities",
    domainAuthorityTier: "niche",
    platforms: ["web"],
    notes:
      "Curated SaaS reviews and tool roundups. Niche reach but a relevant, editorial backlink for a web product. Low effort to get listed.",
  },
  {
    name: "Tiny Startups",
    url: "https://www.tinystartups.com/",
    category: "Indie & maker communities",
    domainAuthorityTier: "niche",
    platforms: ["ios", "android", "web"],
    notes:
      "Newsletter + launch community for small bootstrapped products. Niche but high-fit audience for the ICP; a friendly second-wave launch spot.",
  },
  {
    name: "MicroLaunch",
    url: "https://microlaunch.net/",
    category: "Indie & maker communities",
    domainAuthorityTier: "niche",
    platforms: ["web"],
    notes:
      "Daily launch platform aimed at micro-SaaS and indie makers. Smaller than Product Hunt but a relevant audience and an easy extra launch surface.",
  },

  // --- AI tool directories (high-velocity, GEO-relevant) -------------------
  {
    name: "There's An AI For That",
    url: "https://theresanaiforthat.com/submit/",
    category: "AI tool directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "The dominant AI-tools directory and a heavily-cited GEO source. If the product has an AI angle this is a top-tier listing; free with a queue, paid to expedite.",
  },
  {
    name: "Futurepedia",
    url: "https://www.futurepedia.io/submit-tool",
    category: "AI tool directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Large, well-trafficked AI-tools directory. Strong category traffic and a high-DA backlink for AI products. Free submission tier with a paid fast-track.",
  },
  {
    name: "AI Tools Directory (Toolify)",
    url: "https://www.toolify.ai/submit",
    category: "AI tool directories",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Large AI-tool aggregator with category rankings and steady SEO traffic. Free listing; a useful AI-category backlink and discovery surface.",
  },
  {
    name: "Future Tools",
    url: "https://www.futuretools.io/submit-a-tool",
    category: "AI tool directories",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Matt Wolfe's curated AI-tools directory with a large newsletter audience. Curated (not guaranteed) but a high-quality, relevant placement when accepted.",
  },
  {
    name: "AI Scout",
    url: "https://aiscout.net/",
    category: "AI tool directories",
    domainAuthorityTier: "niche",
    platforms: ["web"],
    notes:
      "AI-tools directory with category browsing. Niche reach but easy to get listed; another indexed AI-category backlink. Low effort.",
  },

  // --- App stores & app discovery (ASO) ------------------------------------
  {
    name: "Apple App Store",
    url: "https://developer.apple.com/app-store/submitting/",
    category: "App stores",
    domainAuthorityTier: "high",
    platforms: ["ios"],
    notes:
      "The listing itself — table stakes, but the metadata is the ASO surface. Owning the title/subtitle/keyword field is upstream of every other ASO action.",
  },
  {
    name: "Google Play Store",
    url: "https://play.google.com/console/about/",
    category: "App stores",
    domainAuthorityTier: "high",
    platforms: ["android"],
    notes:
      "The Android listing. Title + short/long description are the ASO levers; Play indexes long-description text more aggressively than the App Store. Table stakes for Android.",
  },
  {
    name: "AppAdvice",
    url: "https://appadvice.com/",
    category: "App discovery",
    domainAuthorityTier: "mid",
    platforms: ["ios"],
    notes:
      "Long-running iOS app discovery site and editorial. A listing/feature is a relevant, high-DA backlink and an iOS-audience referral source.",
  },
  {
    name: "AppGrooves",
    url: "https://appgrooves.com/",
    category: "App discovery",
    domainAuthorityTier: "mid",
    platforms: ["ios", "android"],
    notes:
      "App discovery and comparison site covering both stores. Category roundups rank in search; a useful cross-platform app-discovery backlink.",
  },
  {
    name: "148Apps",
    url: "https://www.148apps.com/",
    category: "App discovery",
    domainAuthorityTier: "niche",
    platforms: ["ios"],
    notes:
      "Established iOS app review and database site. Niche but credible; a review or database entry adds a relevant backlink and some referral traffic.",
  },

  // --- Subscription-app ecosystem (ICP-concentrated) -----------------------
  {
    name: "RevenueCat Showcase",
    url: "https://www.revenuecat.com/showcase/",
    category: "Subscription-app ecosystem",
    domainAuthorityTier: "mid",
    platforms: ["ios", "android"],
    notes:
      "Per §3, the highest-leverage single channel: the ICP (subscription-app founders) is concentrated here. Showcase listing plus Sub Club community participation. Exact-fit audience.",
  },
  {
    name: "Sub Club (RevenueCat) Community",
    url: "https://subclub.com/",
    category: "Subscription-app ecosystem",
    domainAuthorityTier: "niche",
    platforms: ["ios", "android"],
    notes:
      "RevenueCat's subscription-app podcast/community. Not a directory per se, but the densest concentration of the ICP anywhere — participation seeds the highest-fit referrals.",
  },

  // --- Web presence / general business directories -------------------------
  {
    name: "Crunchbase",
    url: "https://www.crunchbase.com/",
    category: "Business directories",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "Company profile on a very-high-DA, widely-cited database. Free basic profile; a foundational, trusted entity backlink that also feeds AI answers (GEO).",
  },
  {
    name: "Google Business Profile",
    url: "https://www.google.com/business/",
    category: "Business directories",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Free, foundational brand entity in Google's own graph. Strengthens branded SERPs and the knowledge panel; worth claiming even for a software-only company.",
  },
  {
    name: "Trustpilot",
    url: "https://business.trustpilot.com/signup",
    category: "Business directories",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "High-DA review platform that ranks for '{brand} reviews'. A claimed profile owns that branded query and seeds social proof. Free tier to start collecting reviews.",
  },
  {
    name: "Reddit (relevant communities)",
    url: "https://www.reddit.com/",
    category: "Communities",
    domainAuthorityTier: "high",
    platforms: ["ios", "android", "web"],
    notes:
      "Not a directory — but the right subreddit (e.g. r/SaaS, r/SideProject, r/nosurf) is where the ICP already asks the question your product answers. Participate first; never drop-and-run.",
  },
  {
    name: "DevHunt",
    url: "https://devhunt.org/",
    category: "Indie & maker communities",
    domainAuthorityTier: "mid",
    platforms: ["web"],
    notes:
      "Product Hunt-style launch board built by and for developers. Free; a relevant launch surface and backlink when the product is developer-adjacent.",
  },
  {
    name: "Hacker News (Launch HN / new)",
    url: "https://news.ycombinator.com/newest",
    category: "Launch platforms",
    domainAuthorityTier: "high",
    platforms: ["web"],
    notes:
      "Beyond Show HN: thoughtful comments on relevant threads (and a later Launch HN if YC-backed) keep the brand visible to the technical ICP. Contribute value, don't spam links.",
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * All directories where a listing is genuinely useful for the given platform.
 *
 * Used by the SEO/ASO action-card builder (§6 module 5) to scope the weekly
 * "submit to these N directories" card to the founder's actual platform
 * (ios / android / web), and by the future `/tools` page for platform filters.
 *
 * Order is preserved from `curatedDirectories` (leverage-sorted within groups),
 * so callers can simply take the first N for a sensible "start here" set.
 */
export function directoriesByPlatform(
  platform: DirectoryPlatform,
): readonly Directory[] {
  return curatedDirectories.filter((d) => d.platforms.includes(platform));
}
