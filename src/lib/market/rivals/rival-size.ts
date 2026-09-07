// BUILD §6.6 — what one tracked rival's size *is*, with nothing that
// measures it.
//
// **Its own file so a screen can name the type without buying the vendor**
// (issue #223). `size.ts` declares the measurement — it imports
// `rankedKeywords`, and through it the whole DataForSEO client — and
// `offer.ts` names `RivalSize` to decide REQ-096 c6's offer. Overview reads
// the stored entry and hands it to `swapOffer`, so the type reached it
// through `size.ts`, and with it the vendor: `tests/app/overview/page.test.tsx`
// asserts that this screen's module graph reaches no vendor client at all,
// and it stopped being true.
//
// The break is at file granularity and takes no dependency out — the same
// move ADR-092 makes in the publishing subsystem: the shape moves to a leaf
// that imports one type and nothing else, `size.ts` re-exports it so every
// existing spelling is unchanged, and the measurement stays exactly where
// it was.
import type { RivalSizeBand } from "./band";

/**
 * One tracked rival's size, or the named reason it has none.
 *
 * The `unsized` arm carries **no** band and **no** count, so no surface
 * can print a band for a rival that has not been measured — the arm is a
 * state with a reason on it, never a `null`, an `undefined` or an omitted
 * element (REQ-096 c5).
 *
 * `current` is required on the `sized` arm: a surface cannot omit the
 * distinction between a count taken in this pass and one carried forward
 * from an earlier one by omitting a field.
 */
export type RivalSize =
  | {
      domain: string;
      state: "sized";
      /** Searches this rival appears in: the vendor's own total, or — where
       *  it reported none — the rows that call bought, which understates
       *  and so bands nearer (#117). A plain number either way: the
       *  stored blob's shape is unchanged, so no report version moves. */
      rankedCount: number;
      /** Derived from `rankedCount` and the customer's own count, never
       *  stored independently of them: re-deriving from the two counts
       *  reproduces this value, and a test asserts it. */
      band: RivalSizeBand;
      at: Date;
      current: boolean;
    }
  | {
      domain: string;
      state: "unsized";
      because: "awaiting_deep_pass" | "added_since_last_sizing";
    };
