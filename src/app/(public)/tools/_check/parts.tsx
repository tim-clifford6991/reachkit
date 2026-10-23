// The pieces both tools and their index draw: the line under the form, a
// result's heading with the example's caption, a Google result, and a
// status badge. daisyUI classes in place.
import type React from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { EXAMPLE_BUSINESS, EXAMPLE_CITY } from "./example";
import type { PageTags } from "./read";

export const RESULT_ID = "res";
const SMALL = "text-base-content/70 text-sm";
const CALLOUT = "badge badge-primary badge-sm shrink-0";

/** `https://host/path` as a reader names it: `host/path`. */
export function pagePlace(url: string): string {
  const u = new URL(url);
  return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
}

/** What a check costs the visitor, under each tool's field and on each card. */
export function MicroLine(): React.JSX.Element {
  return <p className={SMALL}>{copy("tools.micro")}</p>;
}

export function Status(p: { fine: boolean }): React.JSX.Element {
  const Icon = p.fine ? CircleCheck : CircleAlert;
  return (
    <span className={`badge badge-sm shrink-0 gap-1 ${p.fine ? "badge-success" : "badge-warning"}`}>
      <Icon size={12} strokeWidth={2} aria-hidden />
      {copy(p.fine ? "tools.status.fine" : "tools.status.fix")}
    </span>
  );
}

/** The result's heading, and on the example the line saying it measures no site. */
export function ResultHead(p: { heading: string; example: boolean }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 id={RESULT_ID} className="break-words">
        {p.heading}
      </h2>
      {p.example ? (
        <p className={SMALL}>{copy("tools.example", { business: EXAMPLE_BUSINESS, city: EXAMPLE_CITY })}</p>
      ) : null}
    </div>
  );
}

/** A number pinned to the part of a drawing a line below explains. */
export function Callout(p: { n: number }): React.JSX.Element {
  return (
    <span className={CALLOUT} aria-hidden>
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
          <span className="bg-base-300 w-6 rounded-full text-xs">{name.charAt(0).toUpperCase()}</span>
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
