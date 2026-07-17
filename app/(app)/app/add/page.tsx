/**
 * /app/add — add a tracked product from INSIDE the app, as one cohesive flow:
 * URL → scanning → competitors → dashboard (owner report 2026-07-17: the old
 * flow redirected straight to the dashboard and left the competitor pick to a
 * later banner, so onboarding felt "disconnected").
 *
 * Replaces the switcher's old link to the PUBLIC /scan page, which pushed a
 * paying user to an entitlement-blind PublicReport (always redacted to free,
 * always an "Unlock full report" CTA) for a product they already pay for.
 * PublicReport is deliberately public-safe; we route around it, never weaken it.
 *
 * Not assertPaid-gated (see actions.ts) — a free zero-app user reaching this
 * page can still add their first product, same as Settings does today.
 */
import { buildMetadata } from "@/lib/seo";
import { AddFlow } from "./add-flow";

export const metadata = buildMetadata({ title: "Add a product", path: "/app/add" });

export default function AddProductPage() {
  return <AddFlow />;
}
