/**
 * SettingsMain — the captured app "Settings" tab (plan / tracked product /
 * scoring cards), converted 1:1 and wired to live tier + app data. Renders
 * inside the captured AppShell.
 */
import { CheckoutButton } from "@/components/app/checkout-button";
import { ProductUrlForm } from "./settings-product-url-form";

const SG = "Space Grotesk", JM = "JetBrains Mono", PJ = "Plus Jakarta Sans";
const SUPPORT_EMAIL = "hello@reachkit.app";

export interface SettingsMainProps {
  planTitle: string;
  planDesc: string;
  upgradeLabel: string | null;
  /** Error fallback for the one-click checkout (the billing/compare page). */
  upgradeHref: string;
  /** Plan the upgrade CTA checks out directly (free→solo, solo→growth). */
  upgradePlan: "solo" | "growth" | null;
  appName: string;
  appInitial: string;
  productMeta: string;
  dataFresh: boolean;
  /** Present when the user has a tracked app — enables the product-URL editor. */
  appId: string | null;
  storeUrl: string | null;
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 12 }}>
          <div style={{ flex: "1 1 0%" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--c-action)" }}>{p.planTitle}</div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginTop: 2 }}>{p.planDesc}</div>
          </div>
          {p.upgradeLabel && p.upgradePlan && (
            // One-click Stripe checkout (W6) — /app/billing only as fallback.
            <CheckoutButton plan={p.upgradePlan} fallbackHref={p.upgradeHref} style={{ fontFamily: "Plus Jakarta Sans", fontWeight: 600, fontSize: 13, color: "#fff", background: "var(--c-action)", border: "none", borderRadius: 8, padding: "8px 14px" }}>{p.upgradeLabel}</CheckoutButton>
          )}
        </div>
      </Card>
      <Card title="Tracked product">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, var(--c-action), #9A88FF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontFamily: SG }}>{p.appInitial}</span>
          <div style={{ flex: "1 1 0%" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{p.appName}</div>
            <div style={{ fontSize: 12.5, color: "var(--c-faint)" }}>{p.productMeta}</div>
          </div>
          {p.dataFresh && <span style={{ fontSize: 12, fontWeight: 600, color: "#1F9D5B", background: "var(--c-tint-green)", padding: "4px 10px", borderRadius: 7 }}>data fresh</span>}
        </div>
        {p.appId && (
          <ProductUrlForm appId={p.appId} initialUrl={p.storeUrl ?? ""} />
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "14px 16px",
            background: "var(--c-tint-red)",
            border: "1px solid var(--c-line)",
            borderRadius: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--c-ink)" }}>Delete account</div>
            <div style={{ fontSize: 12.5, color: "var(--c-muted)", marginTop: 2 }}>
              Permanently remove your account and tracked data. We&apos;ll confirm by email.
            </div>
          </div>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Delete my ReachKit account")}`}
            style={{
              flexShrink: 0,
              fontFamily: PJ,
              fontWeight: 600,
              fontSize: 13,
              color: "#B23B3B",
              background: "#fff",
              border: "1px solid #E8C6C6",
              borderRadius: 8,
              padding: "8px 14px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Delete account
          </a>
        </div>
      </Card>
    </div>
  );
}
