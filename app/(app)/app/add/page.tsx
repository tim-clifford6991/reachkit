/**
 * /app/add — add a tracked product from INSIDE the app.
 *
 * Replaces the switcher's old link to the PUBLIC /scan page, which pushed a
 * paying user to /scan/{slug} — an entitlement-blind PublicReport that always
 * redacts to free and always shows an "Unlock full report" CTA, for a product
 * they already pay for. PublicReport is deliberately public-safe; we route
 * around it rather than weaken it.
 *
 * Not assertPaid-gated (see actions.ts) — a free zero-app user reaching this
 * page can still add their first product, same as Settings does today.
 */
import { buildMetadata } from "@/lib/seo";
import { AddProductForm } from "./add-product-form";

export const metadata = buildMetadata({ title: "Add a product", path: "/app/add" });

export default function AddProductPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--c-muted)", margin: 0 }}>
        We&apos;ll scan it and start tracking its discoverability. This takes about a minute — you can keep using
        your other products while it runs.
      </p>
      <div style={{ marginTop: 10 }}>
        <AddProductForm />
      </div>
    </div>
  );
}
