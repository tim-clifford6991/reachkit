// Issue 1458 — the free tools, at the address v1 and v2 published: the two
// page tools and the free scan, which is what v2's AI visibility check became.
// Each card shows what its tool returns, read off the example business.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, FileText, ListChecks, Search } from "lucide-react";
import { SITE_PROFILE } from "@/lib/config/constants";
import { bandOf } from "@/lib/measure/bands";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { HOW_FACTS } from "../_how/facts";
import { EXAMPLES } from "../_how/specimen";
import { LearnClose, LibraryPage } from "../_library/parts";
import { onPageChecks } from "./_check/checks";
import { EXAMPLE_META, EXAMPLE_ON_PAGE } from "./_check/example";
import { GoogleResult, MicroLine, Status } from "./_check/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.tools);

const EYEBROW: CopyKey = "tools.eyebrow";
const PAGE_TEST_ID = "tools";
const CARD = "card bg-base-100 shadow-(--shadow-card) w-full min-w-0";
const TILE = `${CARD} motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5`;
const WELL = "rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-3";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const SCAN_HREF = `/#${FIELD_SECTION_ID}`;
const SMALL = "text-base-content/70 text-sm";
/** The on-page card shows the first three of its example's checks. */
const SHOWN = 3;
const PAGES = Array.from({ length: SITE_PROFILE.MAX_PAGES }, (_, i) => i);

/** A site's pages as squares, the first `filled` of them in colour. */
function Squares(p: { filled: number }): React.JSX.Element {
  return (
    <span className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5" aria-hidden>
      {PAGES.map((i) => (
        <span key={i} aria-hidden className={`aspect-square rounded-xs ${i < p.filled ? "bg-primary" : "bg-base-300"}`} />
      ))}
    </span>
  );
}

function Reach(p: { icon: typeof Search; name: CopyKey; reach: string; filled: number }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="flex items-center gap-2 font-semibold">
        <p.icon {...ICON} />
        {copy(p.name)}
      </span>
      <Squares filled={p.filled} />
      <span className={SMALL}>{p.reach}</span>
    </div>
  );
}

function CardHead(p: { icon: typeof Search; name: CopyKey }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <p.icon {...ICON} />
      <h2 className="card-title text-base">{copy(p.name)}</h2>
    </div>
  );
}

function OnPageExample(): React.JSX.Element {
  const checks = onPageChecks(EXAMPLE_ON_PAGE);
  const fine = checks.filter((c) => c.fine).length;
  return (
    <div className={WELL}>
      <span className="flex items-center gap-3">
        <span
          aria-hidden
          className="radial-progress text-success after:hidden [--size:2.5rem] [--thickness:5px]"
          style={{ "--value": (fine / checks.length) * 100 } as React.CSSProperties}
        />
        <strong>{copy("tools.fine.of", { fine, total: checks.length })}</strong>
      </span>
      {checks.slice(0, SHOWN).map((c) => (
        <span key={c.name} className="flex min-w-0 items-center justify-between gap-2 text-sm">
          <span>{copy(c.name)}</span>
          <Status fine={c.fine} />
        </span>
      ))}
    </div>
  );
}

function ScanExample(): React.JSX.Element {
  const score = EXAMPLES.plumber.report.score;
  return (
    <div className={`${WELL} flex-row items-center`}>
      <span
        aria-hidden
        className="radial-progress text-warning after:hidden [--size:2.5rem] [--thickness:5px]"
        style={{ "--value": score } as React.CSSProperties}
      />
      <strong>{copy("how.start.score", { score, max: 100 })}</strong>
      <span className="badge badge-soft badge-warning">{copy(`band.score.${bandOf(score)}` as CopyKey)}</span>
    </div>
  );
}

interface Tool {
  readonly href: string;
  readonly icon: typeof Search;
  readonly name: CopyKey;
  readonly line: CopyKey;
  readonly cta: CopyKey;
  readonly example: () => React.JSX.Element;
}

const TOOLS: readonly Tool[] = [
  {
    href: "/tools/on-page-check",
    icon: ListChecks,
    name: "tools.onpage.name",
    line: "tools.onpage.line",
    cta: "tools.onpage.cta",
    example: OnPageExample,
  },
  {
    href: "/tools/meta-preview",
    icon: Eye,
    name: "tools.meta.name",
    line: "tools.meta.line",
    cta: "tools.meta.cta",
    example: () => <GoogleResult tags={EXAMPLE_META} />,
  },
];

function ToolCard(p: Tool): React.JSX.Element {
  return (
    <li className="flex min-w-0">
      <Link href={p.href} className={TILE}>
        <div className="card-body gap-3">
          <CardHead icon={p.icon} name={p.name} />
          <p.example />
          <span>{copy(p.line)}</span>
          <MicroLine />
          <span className="text-primary mt-auto flex items-center gap-1 font-semibold">
            {copy(p.cta)}
            <ArrowRight {...ICON} />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function ToolsPage(): React.JSX.Element {
  return (
    <LibraryPage testId={PAGE_TEST_ID} eyebrow={EYEBROW} title={copy("tools.title")} wide>
      <div className="grid min-w-0 gap-6 md:grid-cols-2 md:items-center">
        <p className="max-w-(--w-read)">{copy("tools.lead")}</p>
        <figure className={`${CARD} card-body gap-4`} aria-label={copy("tools.figure.label")}>
          <Reach icon={FileText} name="tools.figure.tool" reach={copy("tools.figure.tool.reach")} filled={1} />
          <Reach
            icon={Search}
            name="tools.figure.scan"
            reach={copy("tools.figure.scan.reach", { pages: SITE_PROFILE.MAX_PAGES, searches: HOW_FACTS.searches })}
            filled={SITE_PROFILE.MAX_PAGES}
          />
          <figcaption className={SMALL}>{copy("tools.figure.caption")}</figcaption>
        </figure>
      </div>
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
        <li className="flex min-w-0">
          <div className={CARD}>
            <div className="card-body gap-3">
              <CardHead icon={Search} name="tools.scan.name" />
              <ScanExample />
              <p>{copy("tools.scan.line")}</p>
              <p className={SMALL}>{copy("landing.hero.assurance")}</p>
              <Link href={SCAN_HREF} className="btn btn-soft btn-primary mt-auto self-start">
                {copy("landing.submit.label")}
                <ArrowRight {...ICON} />
              </Link>
            </div>
          </div>
        </li>
      </ul>
      <LearnClose variant="tools" />
    </LibraryPage>
  );
}
