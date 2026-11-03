// The pieces both tools and their index draw: a result's heading, a Google
// result, and a status badge. daisyUI classes in place.
import { Fragment } from "react";
import type React from "react";
import { Check, TriangleAlert } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import type { PageTags } from "./read";

export const RESULT_ID = "res";
const SLASH = "/";
const CALLOUT = "badge badge-sm shrink-0";

/** `https://host/path` as a reader names it: `host/path`. */
export function pagePlace(url: string): string {
  const u = new URL(url);
  return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
}

export function Status(p: { fine: boolean }): React.JSX.Element {
  const Icon = p.fine ? Check : TriangleAlert;
  return (
    <span className={`badge badge-soft badge-sm shrink-0 gap-1 ${p.fine ? "badge-success" : "badge-warning"}`}>
      <Icon size={12} strokeWidth={2} aria-hidden />
      {copy(p.fine ? "tools.status.fine" : "tools.status.fix")}
    </span>
  );
}

/** The result's heading, with the page it read in mono, free to wrap after each slash. */
export function ResultHead(p: { heading: string; place: string }): React.JSX.Element {
  const at = p.heading.indexOf(p.place);
  return (
    <h2 id={RESULT_ID} className="break-words">
      {at < 0 ? (
        p.heading
      ) : (
        <>
          {p.heading.slice(0, at)}
          <span className="font-mono wrap-anywhere">
            {p.place.split("/").map((part, i) => (
              <Fragment key={i}>
                {i === 0 ? null : <>{SLASH}<wbr /></>}
                {part}
              </Fragment>
            ))}
          </span>
          {p.heading.slice(at + p.place.length)}
        </>
      )}
    </h2>
  );
}

/** A number pinned to the part of a drawing a line below explains. */
/** Primary by default; a mark on a check takes the check's tone. */
export function Callout(p: { n: number; fine?: boolean }): React.JSX.Element {
  const tone = p.fine === undefined ? "badge-primary" : p.fine ? "badge-success" : "badge-warning";
  return (
    <span className={`${CALLOUT} ${tone}`} aria-hidden>
      {p.n}
    </span>
  );
}

/** How the page reads in a Google result: its name, its place, its title and text. */
export function GoogleResult(p: { tags: PageTags; numbered?: boolean }): React.JSX.Element {
  const t = p.tags;
  const u = new URL(t.url);
  const name = t.share["og:site_name"] || u.hostname;
  const crumbs = [u.hostname, ...u.pathname.split("/").filter((s) => s !== "")].join(" › ");
  return (
    <div className="rounded-box bg-base-100 border-base-300 flex min-w-0 flex-col gap-1 border p-3">
      <span className="flex min-w-0 items-center gap-2">
        <span className="avatar avatar-placeholder" aria-hidden>
          <div className="bg-base-300 size-6 rounded-full text-xs">{name.charAt(0).toUpperCase()}</div>
        </span>
        <span className="flex min-w-0 flex-col text-xs">
          <span className="break-words">{name}</span>
          <span className="text-base-content/70 break-all">{crumbs}</span>
        </span>
      </span>
      <span className="text-primary flex min-w-0 items-start gap-1 text-base break-words">
        {p.numbered === true ? <Callout n={1} /> : null}
        {t.title === "" ? copy("tools.preview.untitled") : t.title}
      </span>
      <span className="text-base-content/70 flex min-w-0 items-start gap-1 text-sm break-words">
        {p.numbered === true ? <Callout n={2} /> : null}
        {t.description === "" ? copy("tools.preview.undescribed") : t.description}
      </span>
    </div>
  );
}
