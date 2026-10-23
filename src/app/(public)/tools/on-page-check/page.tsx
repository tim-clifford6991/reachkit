// Issue 1458 — the free on-page check, at the address v1 and v2 published.
// One page, read once, ten checks, each fine or to fix with what was found.
// It costs nothing: no vendor, no model, nothing stored. Before an address
// is typed it draws the example page's result, in the same shape.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CircleAlert, CircleCheck } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../../_seo/routes";
import { staticMetadata } from "../../_seo/metadata";
import { BackLink, BODY, CARD, checkedDomain, LearnClose, LibraryPage } from "../../_library/parts";
import { CHECK_GROUPS, onPageChecks, type CheckResult } from "../_check/checks";
import { EXAMPLE_ON_PAGE } from "../_check/example";
import { Callout, MicroLine, pagePlace, ResultHead, RESULT_ID, Status } from "../_check/parts";
import { readPage, type PageTags } from "../_check/read";
import { ReadProblem, ToolForm } from "../_check/ToolForm";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.onPageCheck);

const EYEBROW: CopyKey = "tools.eyebrow";
const MORE: CopyKey = "tools.more";
const PAGE_TEST_ID = "on-page-check";
const INDEX = "/tools";
const SMALL = "text-base-content/70 text-sm";
const LABEL = "text-base-content/70 text-xs font-semibold tracking-wide uppercase";
/** The three checks the sketch of the page points at. */
const MARKED: readonly CopyKey[] = ["tools.check.h1", "tools.check.description", "tools.check.images"];

type Props = { searchParams: Promise<{ url?: string | string[] }> };

function Row(p: { c: CheckResult }): React.JSX.Element {
  const Icon = p.c.fine ? CircleCheck : CircleAlert;
  return (
    <li className="list-row min-w-0 items-start">
      <Icon size={20} strokeWidth={1.75} aria-hidden className={p.c.fine ? "text-success" : "text-warning"} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">{copy(p.c.name)}</span>
        <span className={`${SMALL} line-clamp-2 break-words`}>{p.c.line}</span>
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
  const picture = "bg-base-300 block aspect-video w-1/3 rounded";
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div className="mockup-browser border-base-300 bg-base-200 min-w-0 border" role="img" aria-label={copy("tools.mark.label")}>
        <div className="mockup-browser-toolbar">
          <div className="input min-w-0 truncate font-mono text-xs">{pagePlace(p.tags.url)}</div>
        </div>
        <div className="bg-base-100 flex min-w-0 flex-col gap-3 p-4">
          <span className="flex items-center gap-2">
            <Callout n={1} />
            <span aria-hidden className={`${bar} w-2/3`} />
          </span>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <Callout n={2} />
            <span className="min-w-0 truncate italic">
              {p.tags.description === "" ? copy("tools.mark.nodescription") : p.tags.description}
            </span>
          </span>
          <span aria-hidden className={`${bar} w-full`} />
          <span className="flex items-center gap-2">
            <Callout n={3} />
            <span aria-hidden className={picture} />
            <span aria-hidden className={picture} />
          </span>
        </div>
      </div>
      <figcaption className={`${SMALL} flex flex-wrap gap-x-4 gap-y-1`}>
        {marked.map((c, i) => (
          <span key={c.name} className="flex items-center gap-1">
            <Callout n={i + 1} />
            {mark(c, p.tags)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function OnPageResult(p: { tags: PageTags; example: boolean }): React.JSX.Element {
  const checks = onPageChecks(p.tags);
  const toFix = checks.filter((c) => !c.fine);
  const fine = checks.length - toFix.length;
  return (
    <section aria-labelledby={RESULT_ID} className="flex min-w-0 flex-col gap-4" data-testid="on-page-result">
      <ResultHead
        heading={copy("tools.result", { fine, total: checks.length, url: pagePlace(p.tags.url) })}
        example={p.example}
      />
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className={CARD}>
          <div className={BODY}>
            <p className="flex flex-wrap items-center gap-2">
              <strong>{copy("tools.fine.count", { n: fine })}</strong>
              {toFix.length === 0 ? null : (
                <span className="badge badge-warning badge-sm">{copy("tools.fix.count", { n: toFix.length })}</span>
              )}
            </p>
            <ul className="list min-w-0">
              {toFix.map((c) => (
                <li key={c.name} className="list-row min-w-0">
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
  const read = await readPage(p.raw, (await headers()).get("x-forwarded-for"));
  if (!read.ok) return <ReadProblem read={read} />;
  return <OnPageResult tags={read.tags} example={false} />;
}

export default async function OnPageCheckPage({ searchParams }: Props): Promise<React.JSX.Element> {
  const raw = (await searchParams).url;
  const value = typeof raw === "string" ? raw : "";
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("tools.onpage.name")}>
      <p>{copy("tools.onpage.intro")}</p>
      <ToolForm value={value} />
      <MicroLine />
      {value === "" ? <OnPageResult tags={EXAMPLE_ON_PAGE} example /> : <Result raw={value} />}
      <LearnClose variant="tool-on-page" domain={checkedDomain(value)} />
      <BackLink href={INDEX} label={MORE} />
    </LibraryPage>
  );
}
