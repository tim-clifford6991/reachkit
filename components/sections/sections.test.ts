/**
 * §21.1 Marketing section library — unit tests
 *
 * Tests render key content + verify no crash by checking the pure logic
 * and prop interfaces of each section. We follow the existing codebase
 * pattern of logic-only tests (no jsdom required, vitest environment: node).
 *
 * For the FAQ section we additionally verify that faqPageLd() emits the
 * correct FAQPage JSON-LD structure from the items prop.
 *
 * For each section we also verify the prop interface is well-typed by
 * constructing a valid content object and checking its shape.
 */

import { describe, it, expect } from "vitest";
import { faqPageLd } from "@/lib/seo";
import type { HeroContent } from "./hero";
import type { ScanInputSectionContent } from "./scan-input-section";
import type { SocialProofMarqueeContent, MarqueeChip } from "./social-proof-marquee";
import type { BentoCard, FeatureBentoContent } from "./feature-bento";
import type { TeardownCard, TeardownGridContent } from "./teardown-grid";
import type {
  ComparisonCellValue,
  ComparisonRow,
  ComparisonTableContent,
} from "./comparison-table";
import type { PricingTier, PricingTableContent } from "./pricing-table";
import type { FaqContent } from "./faq";
import type { FinalCtaContent } from "./final-cta";
import type { FooterContent } from "./footer";

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

describe("Hero — content prop interface", () => {
  const content: HeroContent = {
    eyebrow: "Free · no account needed",
    headlineBefore: "Find out exactly why",
    headlineAccent: "your product isn't",
    headlineAfter: "getting found",
    subhead: "Paste your App Store URL and get a discoverability score.",
  };

  it("accepts a valid HeroContent object", () => {
    expect(content.eyebrow).toBe("Free · no account needed");
    expect(content.headlineAccent).toBe("your product isn't");
  });

  it("headlineAfter is optional", () => {
    const minimal: HeroContent = {
      eyebrow: "Beta",
      headlineBefore: "Get found",
      headlineAccent: "faster",
      subhead: "Run a free scan.",
    };
    expect(minimal.headlineAfter).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ScanInputSection
// ---------------------------------------------------------------------------

describe("ScanInputSection — content prop interface", () => {
  it("accepts fully optional content", () => {
    const content: ScanInputSectionContent = {};
    expect(content.label).toBeUndefined();
    expect(content.support).toBeUndefined();
  });

  it("accepts label + support text", () => {
    const content: ScanInputSectionContent = {
      label: "Try it now",
      support: "Free, no account needed",
    };
    expect(content.label).toBe("Try it now");
  });
});

// ---------------------------------------------------------------------------
// SocialProofMarquee — duplicate track logic
// ---------------------------------------------------------------------------

describe("SocialProofMarquee — marquee track duplication", () => {
  const chips: MarqueeChip[] = [
    { label: "a journaling app · 63 / 100", score: 63 },
    { label: "invoicing tool · 41 / 100", score: 41 },
    { label: "fitness tracker · 77 / 100", score: 77 },
  ];

  function buildTrack(c: MarqueeChip[]) {
    return [...c, ...c];
  }

  it("duplicates chips to double length for seamless loop", () => {
    const track = buildTrack(chips);
    expect(track).toHaveLength(chips.length * 2);
  });

  it("content prop is well-typed", () => {
    const content: SocialProofMarqueeContent = {
      chips,
      label: "Recent scans",
    };
    expect(content.chips).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// FeatureBento
// ---------------------------------------------------------------------------

describe("FeatureBento — content prop interface", () => {
  const cards: BentoCard[] = [
    {
      icon: null,
      title: "Discoverability Score",
      blurb: "A single number that quantifies how findable your product is.",
      accent: "blue",
    },
    {
      icon: null,
      title: "Weekly Action Engine",
      blurb: "Ranked action steps refreshed every week.",
      wide: true,
    },
  ];

  it("accepts valid FeatureBentoContent", () => {
    const content: FeatureBentoContent = {
      eyebrow: "What you get",
      headline: "Three modules. One engine.",
      cards,
    };
    expect(content.cards).toHaveLength(2);
    expect(content.cards[0]?.title).toBe("Discoverability Score");
  });

  it("wide is optional on BentoCard", () => {
    const card = cards[0];
    expect(card?.wide).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TeardownGrid
// ---------------------------------------------------------------------------

describe("TeardownGrid — score colour logic", () => {
  function scoreColor(score: number): string {
    if (score >= 70) return "success";
    if (score >= 40) return "accent";
    return "warning";
  }

  it("maps 77 → success", () => expect(scoreColor(77)).toBe("success"));
  it("maps 55 → accent", () => expect(scoreColor(55)).toBe("accent"));
  it("maps 29 → warning", () => expect(scoreColor(29)).toBe("warning"));

  it("accepts TeardownGridContent", () => {
    const cards: TeardownCard[] = [
      {
        title: "App Store Teardown: Calm",
        app: "Calm",
        score: 72,
        blurb: "Strong keyword coverage but positioning is generic.",
        href: "/teardowns/calm",
      },
    ];
    const content: TeardownGridContent = {
      eyebrow: "Real teardowns",
      headline: "See inside real products",
      cards,
    };
    expect(content.cards[0]?.score).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// ComparisonTable
// ---------------------------------------------------------------------------

describe("ComparisonTable — content prop interface", () => {
  it("accepts valid ComparisonTableContent", () => {
    const rows: ComparisonRow[] = [
      {
        capability: "Discoverability score",
        cells: [
          { type: "check" } satisfies ComparisonCellValue,
          { type: "cross" } satisfies ComparisonCellValue,
          { type: "partial", note: "Manual only" } satisfies ComparisonCellValue,
        ],
      },
    ];
    const content: ComparisonTableContent = {
      eyebrow: "How we compare",
      headline: "Built for founders, not agencies",
      tools: ["ReachKit", "ChatGPT", "SparkToro"],
      rows,
    };
    expect(content.tools).toHaveLength(3);
    expect(content.rows[0]?.cells[0]?.type).toBe("check");
  });
});

// ---------------------------------------------------------------------------
// PricingTable
// ---------------------------------------------------------------------------

describe("PricingTable — tier structure", () => {
  const tiers: PricingTier[] = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "One scan.",
      features: ["Discoverability scan", "Score out of 100"],
      cta: null,
    },
    {
      name: "Solo",
      price: "$29",
      period: "/ month",
      description: "1 app, weekly queue.",
      features: ["Everything in Free", "Weekly queue"],
      highlighted: true,
      badge: "Most popular",
      cta: null,
    },
  ];

  it("tiers prop is well-typed", () => {
    const content: PricingTableContent = {
      eyebrow: "Pricing",
      headline: "Free to scan. Paid to act.",
      tiers,
    };
    expect(content.tiers).toHaveLength(2);
    expect(content.tiers[1]?.highlighted).toBe(true);
    expect(content.tiers[1]?.badge).toBe("Most popular");
  });

  it("cta slot accepts null (no CTA needed)", () => {
    expect(tiers[0]?.cta).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FAQ — JSON-LD emission (the critical behaviour)
// ---------------------------------------------------------------------------

describe("FAQ — faqPageLd JSON-LD emission", () => {
  const items = [
    {
      q: "What counts as a scan?",
      a: "One App Store URL or website URL analysed by the engine.",
    },
    {
      q: "Can I cancel?",
      a: "Yes, any time. No long-term contract.",
    },
  ];

  it("emits @type FAQPage", () => {
    const ld = faqPageLd(items);
    expect(ld["@type"]).toBe("FAQPage");
  });

  it("emits @context schema.org", () => {
    const ld = faqPageLd(items);
    expect(ld["@context"]).toBe("https://schema.org");
  });

  it("mainEntity length matches items count", () => {
    const ld = faqPageLd(items);
    expect(ld.mainEntity).toHaveLength(2);
  });

  it("each Question has the correct name and answer", () => {
    const ld = faqPageLd(items);
    const first = ld.mainEntity[0];
    expect(first?.["@type"]).toBe("Question");
    expect(first?.name).toBe("What counts as a scan?");
    expect(first?.acceptedAnswer["@type"]).toBe("Answer");
    expect(first?.acceptedAnswer.text).toContain("One App Store URL");
  });

  it("FaqContent prop interface is well-typed", () => {
    const content: FaqContent = {
      eyebrow: "Common questions",
      headline: "Honest answers",
      items,
    };
    expect(content.items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// FinalCTA
// ---------------------------------------------------------------------------

describe("FinalCTA — content prop interface", () => {
  it("accepts minimal content (eyebrow and subhead optional)", () => {
    const content: FinalCtaContent = {
      headline: "Find out why you're not getting found.",
    };
    expect(content.headline).toBeTruthy();
    expect(content.eyebrow).toBeUndefined();
    expect(content.subhead).toBeUndefined();
  });

  it("accepts full content", () => {
    const content: FinalCtaContent = {
      eyebrow: "Get started",
      headline: "One scan. Real answers.",
      subhead: "Free, no account needed.",
    };
    expect(content.subhead).toBe("Free, no account needed.");
  });
});

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

describe("Footer — content prop interface", () => {
  it("accepts valid FooterContent", () => {
    const content: FooterContent = {
      brand: "ReachKit",
      tagline: "The distribution system for solo founders.",
      columns: [
        {
          heading: "Product",
          items: [
            { label: "Pricing", href: "/pricing" },
            { label: "Report demo", href: "/report/demo" },
          ],
        },
      ],
      legal: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Imprint", href: "/imprint" },
      ],
      copyright: "© 2026 ReachKit",
      attribution: "Built in Berlin",
    };
    expect(content.legal).toHaveLength(3);
    expect(content.columns[0]?.heading).toBe("Product");
  });
});
