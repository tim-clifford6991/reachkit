// SPEC §2 and §4 — where the business sells, and the other markets it
// declares, worded once for the report's head and the app's settings.
import type React from "react";
import { COUNTRIES } from "@/lib/locale/locales";
import type { BusinessUnderstanding } from "@/lib/business/types";
import { copy } from "@/lib/presentation/copy";

/** Where the business sells, in one line. */
export function whereLine(where: BusinessUnderstanding["where"]): string {
  const country = COUNTRIES[where.country].location;
  if (where.place !== null) return copy("report.read.where.local", { place: where.place.name });
  switch (where.reach) {
    case "national":
      return copy("report.read.where.national", { country });
    case "international":
      return copy("report.read.where.international");
    case "local":
      return copy("report.read.where.measured", { country });
    case null:
      // Issue 1470: a stored scan whose reach nothing stored decides.
      return copy("report.read.where.unread", { country });
  }
}

/** In the app: the other markets the site declares, where it declares any. */
export function AlsoServesNote(p: { n: number | undefined }): React.JSX.Element | null {
  const n = p.n ?? 0;
  if (n === 0) return null;
  return (
    <p className="text-sm text-base-content/70" data-testid="also-serves">
      {n === 1 ? copy("app.locale.also-serves.one") : copy("app.locale.also-serves", { n: String(n) })}
    </p>
  );
}
