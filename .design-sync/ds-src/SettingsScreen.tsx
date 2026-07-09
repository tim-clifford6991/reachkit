import * as React from "react";
import { AppShell } from "./AppShell";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { Badge } from "./Badge";

/**
 * SettingsScreen — the in-app Settings view (`/app/settings`): the AppShell chrome
 * wrapping the product-URL field, the current plan card (Free / Solo / Growth with
 * its upgrade CTA), and the self-service billing link. Mirrors `settings/page.tsx`.
 * Composes Button / TextField / Badge. Renders fully with no props.
 */
export interface SettingsScreenProps {
  appName?: string;
}

const JM = "var(--font-mono)";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--c-ink)", margin: 0 }}>{title}</h3>
      {children}
    </section>
  );
}

export function SettingsScreen({ appName = "nudgi.ai" }: SettingsScreenProps) {
  return (
    <AppShell
      active="settings"
      headerTitle="Settings"
      headerSub={`Your product & plan · ${appName}`}
      user={{ name: "Nadia L.", sub: `${appName} · solo founder` }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "var(--font-sans)" }}>
        {/* PRODUCT */}
        <Card title="Product">
          <TextField label="Product URL" placeholder="https://your-site.com" value="https://nudgi.ai" hint="We re-scan this on your weekly refresh." />
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="primary">Save</Button>
            <Button variant="ghost">Re-scan now</Button>
          </div>
        </Card>

        {/* PLAN */}
        <Card title="Plan">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Badge tone="band-fair">Solo</Badge>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--c-ink)" }}>Solo · $59/mo</span>
              <span style={{ fontSize: 12.5, color: "var(--c-muted)" }}>1 product · weekly re-scan · 20-keyword depth</span>
            </div>
            <div style={{ marginLeft: "auto" }}><Button variant="secondary">Upgrade to Growth</Button></div>
          </div>
        </Card>

        {/* BILLING */}
        <Card title="Billing">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: "var(--c-muted)" }}>Manage your subscription, payment method, and invoices in the billing portal.</span>
            <Button variant="secondary">Open billing portal →</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
