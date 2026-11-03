// Issue 1458 — the free on-page check, at the address v1 and v2 published.
// One page, read once, ten checks, each fine or to fix with what was found.
// It costs nothing: no vendor, no model, nothing stored. Before an address
// is typed it draws the example page's result, in the same shape.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  Building2,
  Eye,
  Heading,
  Image,
  Languages,
  Link,
  Lock,
  MessageSquare,
  Share2,
  Smartphone,
  Type,
  type LucideIcon,
} from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { BAND, BODY, CARD, checkedDomain, LearnClose, LibraryPage, Tile, Trail } from "../../_library/parts";
import { CHECK_GROUPS, onPageChecks, type CheckResult } from "../_check/checks";
import { EXAMPLE_ON_PAGE } from "../_check/example";
import { Callout, pagePlace, ResultHead, RESULT_ID, Status } from "../_check/parts";
import { readPage, type PageTags } from "../_check/read";
import { ReadProblem, ToolForm } from "../_check/ToolForm";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.onPageCheck);

const INDEX_NAME: CopyKey = "tools.eyebrow";
const PAGE_TEST_ID = "on-page-check";
const INDEX = "/tools";
const TRAIL: CopyKey = "compare.item.trail";
const SMALL = "text-base-content/70 text-sm";
const SLASH = "/";
/** The sketch draws at most this many images. */
const STRIP_MAX = 9;
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
/** The three checks the sketch of the page points at. */
const MARKED: readonly CopyKey[] = ["tools.check.h1", "tools.check.description", "tools.check.images"];

type Props = { searchParams: Promise<{ url?: string | string[] }> };

/** Each check's icon, as the board draws it beside the check's name. */
const CHECK_ICON: Partial<Record<CopyKey, LucideIcon>> = {
  "tools.check.title": Type,
  "tools.check.description": MessageSquare,
  "tools.check.share": Share2,
  "tools.check.h1": Heading,
  "tools.check.canonical": Link,
  "tools.check.index": Eye,
  "tools.check.schema": Building2,
  "tools.check.lang": Languages,
  "tools.check.viewport": Smartphone,
  "tools.check.images": Image,
};

function CheckTile(p: { c: CheckResult }): React.JSX.Element | null {
  const Icon = CHECK_ICON[p.c.name];
  return Icon === undefined ? null : <Tile Icon={Icon} tone={p.c.fine ? "success" : "warning"} />;
}

function Row(p: { c: CheckResult }): React.JSX.Element {
  return (
    <li className="list-row min-w-0 items-start">
      <CheckTile c={p.c} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">{copy(p.c.name)}</span>
        <span className={`${SMALL} break-words`}>{p.c.line}</span>
      </span>
      <Status fine={p.c.fine} />
    </li>
  );
}

/** One line under the sketch: what the numbered part of the page holds. */
function mark(c: CheckResult, t: PageTags): string {
  const name = copy(c.name);
  if (c.fine) return copy("tools.mark.fine", { name });
  if (c.name === "tools.check.images") return copy("tools.mark.images", { count: t.imagesWithoutAlt, total: t.images });
  if (c.name === "tools.check.description" && t.description === "") return copy("tools.mark.missing", { name });
  return copy("tools.mark.fix", { name });
}

/** The page, sketched, with the main heading, the text under the link and the images numbered. */
function Sketch(p: { checks: readonly CheckResult[]; tags: PageTags }): React.JSX.Element {
  const marked = MARKED.map((name) => p.checks.find((c) => c.name === name)!);
  const bar = "bg-base-300 block h-2 rounded";
  // One box per image, up to a row's worth; those without a description are dashed, spread through the row.
  const shown = Math.min(p.tags.images, STRIP_MAX);
  const bare = Math.round((p.tags.imagesWithoutAlt / Math.max(p.tags.images, 1)) * shown);
  const strip = Array.from({ length: shown }, (_, i) => Math.floor(((i + 1) * bare) / shown) > Math.floor((i * bare) / shown));
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div className="mockup-browser border-base-300 bg-base-200 min-w-0 border" role="img" aria-label={copy("tools.mark.label")}>
        <div className="mockup-browser-toolbar">
          <span className="rounded-box bg-base-100 flex min-w-0 items-center gap-1.5 px-3 py-1">
            <Lock size={12} strokeWidth={1.75} aria-hidden className="flex-none" />
            <span className="min-w-0 font-mono text-xs break-all">{pagePlace(p.tags.url)}</span>
          </span>
        </div>
        <div className="bg-base-100 flex min-w-0 flex-col gap-3 p-4">
          <span className="flex items-center gap-2">
            <Callout n={1} fine={marked[0]!.fine} />
            <span aria-hidden className={`${bar} w-2/3`} />
          </span>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <Callout n={2} fine={marked[1]!.fine} />
            <span className="min-w-0 break-words italic">
              {p.tags.description === "" ? copy("tools.mark.nodescription") : p.tags.description}
            </span>
          </span>
          <span aria-hidden className={`${bar} w-full`} />
          <span className="flex items-center gap-2">
            <Callout n={3} fine={marked[2]!.fine} />
            <span aria-hidden className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] gap-1">
              {strip.map((bare, i) => (
                <span key={i} aria-hidden className={`h-6 rounded ${bare ? "border-warning bg-warning/10 border border-dashed" : "bg-base-300"}`} />
              ))}
            </span>
          </span>
        </div>
      </div>
      <figcaption className={`${SMALL} flex flex-wrap gap-x-4 gap-y-1`}>
        {marked.map((c, i) => (
          <span key={c.name} className="flex items-center gap-1">
            <Callout n={i + 1} fine={c.fine} />
            {mark(c, p.tags)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function OnPageResult(p: { tags: PageTags }): React.JSX.Element {
  const checks = onPageChecks(p.tags);
  const toFix = checks.filter((c) => !c.fine);
  const fine = checks.length - toFix.length;
  return (
    <section aria-labelledby={RESULT_ID} className={`flex min-w-0 flex-col gap-4 ${BAND}`} data-testid="on-page-result">
      <ResultHead heading={copy("tools.result", { fine, total: checks.length, url: pagePlace(p.tags.url) })} place={pagePlace(p.tags.url)} />
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className={CARD}>
          <div className={BODY}>
            <div className="flex items-center gap-4">
              <span
                className="radial-progress text-success flex-none text-sm font-bold after:hidden [--size:3.75rem] [--thickness:6px]"
                style={{ "--value": (fine / checks.length) * 100 } as React.CSSProperties}
                role="img"
                aria-label={copy("tools.fine.of", { fine, total: checks.length })}
              >
                <span className="text-base-content">
                  {fine}
                  {SLASH}
                  {checks.length}
                </span>
              </span>
              <p className="flex flex-col gap-1">
                <strong>{copy("tools.fine.count", { n: fine })}</strong>
                {toFix.length === 0 ? null : (
                  <span className="badge badge-soft badge-warning badge-sm">{copy("tools.fix.count", { n: toFix.length })}</span>
                )}
              </p>
            </div>
            <ul className="flex min-w-0 flex-col gap-2">
              {toFix.map((c) => (
                <li key={c.name} className="rounded-box bg-warning/10 flex min-w-0 items-start gap-3 p-3">
                  <CheckTile c={c} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <strong>{copy(c.name)}</strong>
                    <span className={`${SMALL} break-words`}>{c.line}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Sketch checks={checks} tags={p.tags} />
      </div>
      <div className={CARD}>
        <div className={BODY}>
          <h3 className="text-base font-semibold">{copy("tools.all", { n: checks.length })}</h3>
          {CHECK_GROUPS.map((group) => (
            <div key={group.name} className="flex min-w-0 flex-col gap-1">
              <h4 className={LABEL}>{copy(group.name)}</h4>
              <ul className="list min-w-0">
                {group.checks.map((name) => (
                  <Row key={name} c={checks.find((c) => c.name === name)!} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function Result(p: { raw: string }): Promise<React.JSX.Element> {
  const read = await readPage(p.raw, await headers());
  if (!read.ok) return <ReadProblem read={read} />;
  return <OnPageResult tags={read.tags} />;
}

export default async function OnPageCheckPage({ searchParams }: Props): Promise<React.JSX.Element> {
  const raw = (await searchParams).url;
  const value = typeof raw === "string" ? raw : "";
  return (
    <LibraryPage
      testId={PAGE_TEST_ID}
      trail={<Trail label={copy(TRAIL)} href={INDEX} index={copy(INDEX_NAME)} here={copy("tools.onpage.name")} />}
      title={copy("tools.onpage.name")}
      lead={<p className="text-lg">{copy("tools.onpage.intro")}</p>}
      aside={<ToolForm value={value} />}
      wide
    >
      {value === "" ? <OnPageResult tags={EXAMPLE_ON_PAGE} /> : <Result raw={value} />}
      <LearnClose variant="tool-on-page" domain={checkedDomain(value)} />
    </LibraryPage>
  );
}
