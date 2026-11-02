// The first read-as chip, kind · industry, worded once for the report and the scan that becomes it.
import { copy } from "@/lib/presentation/copy";
import type { BusinessKind } from "@/lib/market/kinds";

/** The kind's word beside the industry; either alone where the other was not read. */
export function kindAndIndustry(kind: BusinessKind | null | undefined, category: string | null | undefined): string | null {
  const word = kind == null ? null : copy(`report.read.as.kind.${kind}`);
  if (word !== null && category != null) return copy("report.read.as.what", { kind: word, category });
  return word ?? category ?? null;
}
