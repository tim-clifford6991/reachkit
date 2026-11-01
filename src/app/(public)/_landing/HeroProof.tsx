// The hero's proof card: one row per stored proof, never a placeholder. The
// count row needs at least 100 distinct sites scanned (owner, 2026-11-01);
// the listed report's row is ReachKit's own report, drawn with our mark only
// while it has a stored score; the blog's row needs a live article of ReachKit's own. With none of
// them there is no card.
import type React from "react";
import Link from "next/link";
import { ChevronRight, PenLine, ScanSearch } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { ARTICLES_SECTION_ID } from "./sections";
import { BrandMark } from "@/app/_brand/Brand";

const LINE = "flex min-h-18 items-center gap-3.5 px-4.5 py-3.5";
const ROW = `${LINE} hover:bg-base-200`;
const TILE = "rounded-field bg-primary/10 text-primary grid size-10 shrink-0 place-items-center";
/** Below this many sites the count proves nothing, so no row is drawn (decision 2026-11-01-2249). */
const SCANNED_SHOWN_FROM = 100;
const CHEVRON = <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-primary shrink-0" />;

function Lines(p: { title: string; line: string }): React.JSX.Element {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="font-bold break-words">{p.title}</span>
      <span className="text-base-content/70 text-sm">{p.line}</span>
    </span>
  );
}

export async function HeroProof(): Promise<React.JSX.Element | null> {
  // Loaded here, not at the top: the database client checks its environment when it loads.
  const { readLiveExamples } = await import("../_how/examples");
  const { listedCard, scannedSites } = await import("@/lib/scan/gallery");
  const { readOwnArticles } = await import("../_chrome/own-articles");
  const [{ report }, own, sites] = await Promise.all([readLiveExamples(), readOwnArticles(), scannedSites().catch(() => 0)]);
  const card = report === null ? null : await listedCard(report).catch(() => null);
  const scanned = sites >= SCANNED_SHOWN_FROM ? Math.floor(sites / 10) * 10 : null;
  if (scanned === null && card === null && own === null) return null;
  return (
    <div className="card card-border bg-base-100 divide-base-300 w-full min-w-0 divide-y overflow-hidden">
      {scanned !== null && (
        <div className={LINE}>
          <span className={TILE}>
            <ScanSearch size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <Lines title={copy("landing.hero.proof.scanned", { count: String(scanned) })} line={copy("landing.hero.proof.scanned.line")} />
        </div>
      )}
      {report !== null && card !== null && (
        <Link href={`/scan/${report}`} className={ROW}>
          <span className="grid size-10 shrink-0 place-items-center">
            <BrandMark size="lg" />
          </span>
          <Lines title={copy("landing.hero.proof.report", { domain: report, score: String(card.score) })} line={copy("landing.hero.proof.report.open")} />
          {CHEVRON}
        </Link>
      )}
      {own !== null && (
        <a href={`#${ARTICLES_SECTION_ID}`} className={ROW}>
          <span className={TILE}>
            <PenLine size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <Lines title={copy("landing.hero.proof.blog")} line={copy("landing.hero.proof.blog.open")} />
          {CHEVRON}
        </a>
      )}
    </div>
  );
}
