// The hero's one proof: how many sites the free scan has read, drawn only from
// 100 distinct sites scanned (docs/SPEC.md §1 Sites scanned from 100). Below that it is no
// row, never a placeholder or a 0. From 8 sites with a logo at build, the count is the
// logo band's label under the hero instead (§1 Our own report only).
import type React from "react";
import { cache } from "react";
import { ScanSearch } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { LogoBand } from "./LogoBand";
import { LOGO_BAND } from "./sections";

/** Below this many sites the count proves nothing. */
const SCANNED_SHOWN_FROM = 100;

/** Read once per build: the count rounded down to a ten, and whether the band is drawn. */
const proof = cache(async (): Promise<{ count: string | null; drawn: boolean }> => {
  // Loaded here, not at the top: the database client checks its environment when it loads.
  const { readRecent, scannedSites } = await import("@/lib/scan/gallery");
  const [sites, slides] = await Promise.all([scannedSites().catch(() => 0), readRecent(LOGO_BAND.from).catch(() => [])]);
  if (sites < SCANNED_SHOWN_FROM) return { count: null, drawn: false };
  return { count: String(Math.floor(sites / 10) * 10), drawn: slides.length >= LOGO_BAND.from };
});

export async function HeroProof(): Promise<React.JSX.Element | null> {
  const { count, drawn } = await proof();
  if (count === null || drawn) return null;
  return (
    <div className="flex items-center gap-3.5">
      <span className="rounded-field bg-primary/10 text-primary grid size-10 shrink-0 place-items-center">
        <ScanSearch size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-lg font-bold">{copy("landing.hero.proof.scanned", { count })}</span>
        <span className="text-base-content/70 text-sm">{copy("landing.hero.proof.scanned.line")}</span>
      </span>
    </div>
  );
}

/** The band under both hero columns, labelled by the count; not drawn while the count is in the hero. */
export async function ProofBand(): Promise<React.JSX.Element | null> {
  const { count, drawn } = await proof();
  if (count === null || !drawn) return null;
  return <LogoBand label={copy("landing.proof.label", { count })} pause={copy("landing.proof.pause")} play={copy("landing.proof.play")} />;
}
