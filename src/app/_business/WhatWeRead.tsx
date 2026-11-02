// SPEC §2 and §4 — where the business sells, as the report's chip, and the
// other markets it declares, for the app's settings.
import type React from "react";
import { COUNTRIES } from "@/lib/locale/locales";
import type { BusinessUnderstanding } from "@/lib/business/types";
import { copy } from "@/lib/presentation/copy";

/** Where the business sells, or null where nothing stored says: a local
 *  business with no town is the measured market's own chip already. */
export function whereLine(where: BusinessUnderstanding["where"]): string | null {
  if (where.place !== null) return copy("report.read.where.local", { place: where.place.name });
  if (where.reach === "national") return copy("report.read.where.national", { country: COUNTRIES[where.country].location });
  return where.reach === "international" ? copy("report.read.where.international") : null;
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
