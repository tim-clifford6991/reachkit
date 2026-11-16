// Issue 1458 — the free tools, at the address v1 and v2 published: the two
// page tools and the free scan, which is what v2's AI visibility check became.
// Each card shows what its tool returns, read off the example business.
import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye, ListChecks, Search } from "lucide-react";
import { bandOf } from "@/lib/measure/bands";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { PUBLIC_ROUTE_SEO } from "../_seo/routes";
import { staticMetadata } from "../_seo/metadata";
import { FIELD_SECTION_ID } from "../_landing/sections";
import { EXAMPLES } from "../_how/specimen";
import { BAND, LearnClose, LibraryPage, Tile } from "../_library/parts";
import { onPageChecks } from "./_check/checks";
import { EXAMPLE_META, EXAMPLE_ON_PAGE } from "./_check/example";
import { GoogleResult, Status } from "./_check/parts";

export const metadata: Metadata = staticMetadata(PUBLIC_ROUTE_SEO.tools);

const PAGE_TEST_ID = "tools";
const CARD = "card bg-base-100 shadow-(--shadow-card) w-full min-w-0";
const TILE = `${CARD} motion-safe:transition-transform motion-safe:duration-200 hover:-translate-y-0.5`;
const WELL = "rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-3";
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const SCAN_HREF = `/#${FIELD_SECTION_ID}`;
const SMALL = "text-base-content/70 text-sm";
const SLASH = "/";
/** The on-page card shows the first three of its example's checks. */
const SHOWN = 3;
function CardHead(p: { icon: typeof Search; name: CopyKey; solid?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <Tile Icon={p.icon} tone={p.solid ? "solid" : "primary"} />
      <h2 className="card-title text-lg">{copy(p.name)}</h2>
    </div>
  );
}

function OnPageExample(): React.JSX.Element {
  const checks = onPageChecks(EXAMPLE_ON_PAGE);
  const fine = checks.filter((c) => c.fine).length;
  return (
    <div className="rounded-box border-base-300 bg-base-100 flex min-w-0 flex-col border p-3">
      <span className="flex items-center gap-3 pb-2">
        <span
          aria-hidden
          className="radial-progress text-success text-xs font-bold after:hidden [--size:2.75rem] [--thickness:5px]"
          style={{ "--value": (fine / checks.length) * 100 } as React.CSSProperties}
        >
          <span className="text-base-content">
            {fine}
            {SLASH}
            {checks.length}
          </span>
        </span>
        <strong>{copy("tools.fine.of", { fine, total: checks.length })}</strong>
      </span>
      <span className="divide-base-300 flex min-w-0 flex-col divide-y">
        {checks.slice(0, SHOWN).map((c) => (
          <span key={c.name} className="flex min-w-0 items-center justify-between gap-2 py-2 text-sm">
            <span>{copy(c.name)}</span>
            <Status fine={c.fine} />
          </span>
        ))}
      </span>
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
    <LibraryPage
      testId={PAGE_TEST_ID}
      title={copy("tools.title")}
      wide
    >
      <p className="max-w-(--w-read) text-lg">{copy("tools.lead")}</p>
      <section aria-label={copy("tools.list.label")} className={BAND}>
      <ul className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
        <li className="flex min-w-0">
          <div className={`${CARD} border-primary/30 bg-primary/5 border-[1.5px]`}>
            <div className="card-body gap-3">
              <CardHead icon={Search} name="tools.scan.name" solid />
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
      </section>
      <LearnClose variant="tools" />
    </LibraryPage>
  );
}
