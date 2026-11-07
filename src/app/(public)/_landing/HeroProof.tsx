// The hero's one proof: how many sites the free scan has read, drawn only from
// 100 distinct sites scanned (decision 2026-11-01-2249). Below that it is no
// row, never a placeholder or a 0.
import type React from "react";
import { ScanSearch } from "lucide-react";
import { copy } from "@/lib/presentation/copy";

/** Below this many sites the count proves nothing. */
const SCANNED_SHOWN_FROM = 100;

export async function HeroProof(): Promise<React.JSX.Element | null> {
  // Loaded here, not at the top: the database client checks its environment when it loads.
  const { scannedSites } = await import("@/lib/scan/gallery");
  const sites = await scannedSites().catch(() => 0);
  if (sites < SCANNED_SHOWN_FROM) return null;
  return (
    <div className="flex items-center gap-3.5">
      <span className="rounded-field bg-primary/10 text-primary grid size-10 shrink-0 place-items-center">
        <ScanSearch size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-lg font-bold">{copy("landing.hero.proof.scanned", { count: String(Math.floor(sites / 10) * 10) })}</span>
        <span className="text-base-content/70 text-sm">{copy("landing.hero.proof.scanned.line")}</span>
      </span>
    </div>
  );
}
