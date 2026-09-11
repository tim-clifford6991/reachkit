// BUILD §2.2, UI-SPEC §2 `Problem card | .prob .sev-*` — the report's module 3 card (#487).
// src/ui/idiom/ProblemCard.tsx
//
// "left border = severity colour; title · severity badge · who-does-it
// badge · count · optional code block." Its own surface in the approved set
// (`.prob` is drawn beside `.card`, not as one of its heads), on the same
// skin as `IdiomCard` — `--surface`, `--r-box`, `--shadow-card` — with the
// edge as the one addition.
//
// The edge is a **second reading** of a severity the caller has already
// written as a word in `badges` (ruling 9a; §2's "a band is conveyed in
// words, never by colour alone"). It is named by state, not by colour:
// `ok`/`warn`/`bad` are the three state tokens, and `neutral` is the
// hairline for a count that could not be measured, because a dash is not a
// level. The union is what keeps a decorative colour off the edge; the
// stylesheet could not.
//
// `code` is the optional paste block (REQ-009 c2's lines, verbatim, one per
// line). `pre .num` in `src/ui/type.css` gives a code block its own lines
// back from `.num`'s `nowrap` (#352). `children` follows the block — the
// written line or the one control a fix carries.
import type React from "react";

export type ProblemCardEdge = "ok" | "warn" | "bad" | "neutral";

export function ProblemCard(p: {
  title: string;
  /** The severity word and the who-does-it badge, in that order (9a). */
  badges: React.ReactNode;
  edge: ProblemCardEdge;
  /** The module's one headline number, at the ladder's `--h1`. */
  count: React.ReactNode;
  code?: readonly string[];
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rk-prob" data-edge={p.edge}>
      <div className="rk-prob-head">
        <h4>{p.title}</h4>
        <div className="rk-prob-badges">{p.badges}</div>
      </div>
      <div className="rk-prob-count">{p.count}</div>
      {p.code === undefined ? null : (
        <pre className="rk-prob-code">
          <code className="num">{p.code.join("\n")}</code>
        </pre>
      )}
      {p.children ?? null}
    </section>
  );
}
