// The one head every public page but the landing opens with (SPEC §1 *One head on every public page*).
import type React from "react";

/** A title with its catch words in `<em>` (DESIGN *Catch words*); a mark the title does not hold marks nothing. */
export function marked(title: string, mark: string | undefined): React.ReactNode {
  const at = mark ? title.indexOf(mark) : -1;
  if (!mark || at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <em className="text-primary bg-primary/15 rounded-field px-1.5 font-extrabold italic box-decoration-clone">{mark}</em>
      {title.slice(at + mark.length)}
    </>
  );
}

/** Left: where the page sits, the title, the lead and the page's action. Right: one card; below `lg` it follows the lead. */
export function Head(p: {
  /** The eyebrow or the breadcrumb. */
  top?: React.ReactNode;
  title: string;
  mark?: string;
  id?: string;
  lead?: React.ReactNode;
  aside?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={`grid min-w-0 grid-cols-1 items-center gap-8 ${p.aside === undefined ? "" : "lg:grid-cols-2 lg:gap-12"}`}>
      <div className="flex min-w-0 flex-col items-start gap-4">
        {p.top}
        {/* The mark's inline box is taller than t-hero's line, so the padding holds it inside the title. */}
        <h1 id={p.id} className={`t-hero break-words ${p.mark === undefined ? "" : "py-1.5"}`}>
          {marked(p.title, p.mark)}
        </h1>
        {p.lead}
      </div>
      {p.aside === undefined ? null : <div className="min-w-0">{p.aside}</div>}
    </div>
  );
}
