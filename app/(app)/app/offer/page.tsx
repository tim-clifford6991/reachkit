/**
 * /app/offer — legacy single-question view, now consolidated into the full
 * report (/app/report renders the captured ResultsScreen, which includes the
 * "What you offer" positioning mirror). Unlinked; redirect to avoid a stale,
 * duplicate-numbered surface.
 */

import { redirect } from "next/navigation";

export default function OfferPage() {
  redirect("/app/report");
}
