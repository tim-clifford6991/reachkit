/**
 * Teardown content types — §22.2 GEO / answer-shaped editorial
 *
 * A Teardown is a public analysis of a real app's discoverability:
 * scored, evidenced, and written for founders who want to understand
 * what the pipeline surfaces and why.
 */

// ---------------------------------------------------------------------------
// Score breakdown
// ---------------------------------------------------------------------------

export interface TeardownScoreBreakdown {
  content: number;
  outreach: number;
  seo: number;
}

export interface TeardownScore {
  total: number;
  breakdown: TeardownScoreBreakdown;
}

// ---------------------------------------------------------------------------
// Content model
// ---------------------------------------------------------------------------

export interface TeardownSection {
  /** Question-style heading (§22.2 GEO: answer-shaped H2s) */
  heading: string;
  /** First paragraph is always a direct answer to the heading question. */
  body: string[];
}

export interface Teardown {
  slug: string;
  /** App / product name */
  appName: string;
  /** Human-readable title for the teardown */
  title: string;
  /** iOS App Store or web product */
  platform: "ios" | "web";
  score: TeardownScore;
  /** ISO-8601 date this teardown was authored */
  publishedAt: string;
  /** ISO-8601 date the score + findings were last verified against the live app */
  lastVerified: string;
  /** One-sentence deck summary shown in cards and meta descriptions */
  blurb: string;
  /** Opening paragraph — the "so what" for the reader */
  intro: string;
  /** The four-question breakdown sections */
  sections: TeardownSection[];
  /** 3–5 concrete, numbered takeaways */
  takeaways: string[];
}
