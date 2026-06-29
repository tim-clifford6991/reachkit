/**
 * Content effectiveness types (Item 3 — supply-demand-synthesis plan §2.6).
 *
 * Shared taxonomy for classifying and clustering competitor pages so the
 * "Content engine" section of the Supply view is comparable across entities.
 */

/** Fixed content-type vocabulary. One of these per page, never invented labels. */
export type ContentType =
  | "guide"       // comprehensive tutorial or step-by-step how-to
  | "comparison"  // A vs B, alternatives, best-X listicle with scoring
  | "listicle"    // top-N / X best / numbered list posts
  | "landing"     // homepage, product/features/pricing, sign-up
  | "tool"        // interactive calculators, generators, free tools
  | "blog"        // general blog article / news / opinion
  | "docs"        // documentation, help centre, knowledge base
  | "other";      // doesn't fit any of the above

/** One classified + clustered organic page. */
export interface ContentPage {
  url: string;
  title?: string;
  contentType: ContentType;
  /** Which shared topic cluster this page belongs to (from cohort-wide LLM clustering). */
  cluster: string;
  /** Number of organic keywords this page ranks for (from DataForSEO relevant_pages). */
  keywordCount: number;
  /** Estimated traffic value for this page. */
  etv: number;
  /** Word count from HTML fetch (0 when the fetch failed or was skipped). */
  wordCount: number;
}

/** Per-entity slice of a ContentIntel run. */
export interface ContentEntity {
  domain: string;
  /** True for the subject (the user's domain). */
  isSubject: boolean;
  /** Count of pages per content type, for the mix charts. */
  contentTypeMix: Partial<Record<ContentType, number>>;
  pages: ContentPage[];
}

/** One shared topic cluster across the cohort. */
export interface Cluster {
  label: string;
  totalPages: number;
  /** Which domains have at least one page in this cluster. */
  coveredBy: string[];
}

/** Full content-intelligence payload for a subject + cohort. */
export interface ContentIntel {
  subjectDomain: string;
  entities: ContentEntity[];
  /** Cohort-wide clusters, sorted by page count descending. */
  clusters: Cluster[];
}
