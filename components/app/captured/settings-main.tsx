/**
 * SettingsMain — the captured app "Settings" tab (plan / tracked product /
 * scoring cards), converted 1:1 and wired to live tier + app data. Renders
 * inside the captured AppShell.
 */
import { CheckoutButton } from "@/components/app/checkout-button";
import { ManageBillingButton } from "@/components/app/manage-billing-button";
import { ProductUrlForm } from "./settings-product-url-form";
import { AddProductForm } from "./settings-add-product-form";
import { RemoveProductButton } from "./settings-remove-product-button";
import { AccountDeleteLazy } from "./account-delete-lazy";

const SG = "Space Grotesk", JM = "JetBrains Mono", PJ = "Plus Jakarta Sans";

/** One tracked product row. The ACTIVE product also gets the inline URL editor. */
export interface TrackedProduct {
  appId: string;
  name: string;
  initial: string;
  meta: string;
  dataFresh: boolean;
  storeUrl: string | null;
  isActive: boolean;
}

export interface SettingsMainProps {
  planTitle: string;
  planDesc: string;
  upgradeLabel: string | null;
  /** Plan the upgrade CTA checks out directly (free→solo, solo→growth). */
  upgradePlan: "solo" | "growth" | null;
  /** Paid users (active subscription) get the "Manage billing" portal button
   *  right here, so billing is fully self-contained on Settings. */
  isPaid: boolean;
  /** Every tracked product. Empty → the zero-app add form. */
  products: TrackedProduct[];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 24px" }}>
      <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

export function SettingsMain(p: SettingsMainProps) {
  return (
    <div style={{ maxWidth: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
      <Card title="Plan">
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--c-action)" }}>{p.planTitle}</div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginTop: 2 }}>{p.planDesc}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {/* Paid users manage their subscription (update card, invoices,
                cancel) via the Stripe portal — right here, no /app/billing. */}
            {p.isPaid && (
              <ManageBillingButton style={{ fontFamily: PJ, fontWeight: 600, fontSize: 13, color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 8, padding: "8px 14px" }}>
                Manage billing
              </ManageBillingButton>
            )}
            {p.upgradeLabel && p.upgradePlan && (
              // One-click Stripe checkout → straight to Stripe. On error it
              // toasts and stays put (never routes to /app/billing).
              <CheckoutButton
                plan={p.upgradePlan}
                onErrorToast="Couldn't start checkout. Please try again."
                style={{ fontFamily: PJ, fontWeight: 600, fontSize: 13, color: "#fff", background: "var(--c-action)", border: "none", borderRadius: 8, padding: "8px 14px" }}
              >
                {p.upgradeLabel}
              </CheckoutButton>
            )}
          </div>
        </div>
      </Card>
      <Card title={p.products.length > 1 ? "Tracked products" : "Tracked product"}>
        {p.products.length === 0 ? (
          // Zero-app state: every intel page redirects here, so this form is the
          // ONLY way to attach a first product (Path B checkout / provisioning miss).
          <AddProductForm />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {p.products.map((prod, i) => (
              <div key={prod.appId} style={{ paddingTop: i === 0 ? 0 : 16, borderTop: i === 0 ? "none" : "1px solid var(--c-line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, var(--c-action), #9A88FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontFamily: SG, flexShrink: 0 }}>{prod.initial}</span>
                  {/* minWidth:0 + overflowWrap: meta carries the store URL, which
                      has no spaces — so its min-content is the whole string, and a
                      flex child's default min-width:auto would hold this row at that
                      width, forcing a wider layout than a 360px screen. */}
                  <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      {prod.name}
                      {prod.isActive && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-action)", background: "var(--c-tint-violet)", padding: "2px 7px", borderRadius: 6 }}>active</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--c-faint)", overflowWrap: "anywhere" }}>{prod.meta}</div>
                  </div>
                  {prod.dataFresh && <span style={{ fontSize: 12, fontWeight: 600, color: "#1F9D5B", background: "var(--c-tint-green)", padding: "4px 10px", borderRadius: 7, flexShrink: 0 }}>data fresh</span>}
                  <RemoveProductButton appId={prod.appId} appName={prod.name} />
                </div>
                {/* The active product keeps the inline URL editor — that's the one
                    the dashboard is showing and the user is most likely correcting. */}
                {prod.isActive && <ProductUrlForm appId={prod.appId} initialUrl={prod.storeUrl ?? ""} />}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Scoring">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            ["Score version", <span key="v" style={{ fontFamily: JM, fontWeight: 600 }}>v3 · deterministic</span>],
            ["Signals tracked", <span key="s" style={{ fontFamily: JM, fontWeight: 600 }}>18 across 3 pillars</span>],
            ["Weekly auto-scan", <span key="w" style={{ fontWeight: 600, color: "#1F9D5B" }}>On</span>],
            ["Email score digest", <span key="e" style={{ fontWeight: 600, color: "#1F9D5B" }}>On</span>],
          ].map(([label, val]) => (
            <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
              <span style={{ color: "var(--c-muted)" }}>{label}</span>
              {val}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Account">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Data export (GDPR portability) — a plain link; the route streams a
              JSON attachment, so no client JS is needed here. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "14px 16px", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--c-ink)" }}>Export my data</div>
              <div style={{ fontSize: 12.5, color: "var(--c-muted)", marginTop: 2 }}>
                Download everything we hold about your account as a JSON file.
              </div>
            </div>
            <a
              href="/api/app/account/export"
              style={{ flexShrink: 0, fontFamily: PJ, fontWeight: 600, fontSize: 13, color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 8, padding: "8px 14px", textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Export my data
            </a>
          </div>
          {/* Danger zone — hard delete with typed confirmation (client island). */}
          <div style={{ padding: "14px 16px", background: "var(--c-tint-red)", border: "1px solid var(--c-line)", borderRadius: 12 }}>
            <AccountDeleteLazy />
          </div>
        </div>
      </Card>
    </div>
  );
}
