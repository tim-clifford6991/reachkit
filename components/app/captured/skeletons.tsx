/**
 * App loading skeletons — structural placeholders that mirror the captured app
 * components so the layout appears INSTANTLY while data resolves.
 *
 * ⚠️ MAINTENANCE: each skeleton mirrors one captured component's structure. When
 * you add / remove / reshape a tab's layout, update its skeleton here so the
 * placeholder keeps matching. Mapping:
 *   ShellSkeleton     ↔ app-shell.tsx (sidebar + header)
 *   DashboardSkeleton ↔ dashboard-main.tsx
 *   ReportSkeleton    ↔ report/results-screen.tsx
 *   HistorySkeleton   ↔ history-main.tsx
 *   SettingsSkeleton  ↔ settings-main.tsx
 *   ActionsSkeleton   ↔ actions-main.tsx
 *   BillingSkeleton   ↔ billing/billing-actions.tsx
 */

import type { CSSProperties, ReactNode } from "react";

const HAIR = "var(--c-line)";
const SKEL = "var(--c-line)";

function Box({ w, h, r = 8, style }: { w?: number | string; h: number; r?: number; style?: CSSProperties }) {
  return <div className="animate-pulse" style={{ width: w ?? "100%", height: h, borderRadius: r, background: SKEL, flex: w ? "0 0 auto" : undefined, ...style }} />;
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "var(--c-surface)", border: `1px solid ${HAIR}`, borderRadius: 16, padding: "22px 24px", ...style }}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Shell (sidebar + header) — wraps the per-tab content skeleton
// ---------------------------------------------------------------------------

export function ShellSkeleton({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh", background: "var(--c-bg2)" }}>
      <aside style={{ background: "var(--c-surface)", borderRight: "1px solid var(--c-line2)", display: "flex", flexDirection: "column", padding: "18px 14px", height: "100vh", position: "sticky", top: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px" }}>
          <Box w={26} h={26} r={9} />
          <Box w={74} h={14} />
        </div>
        <Box h={48} r={11} style={{ marginBottom: 16 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 6px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Box key={i} w={`${78 - i * 4}%`} h={15} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderTop: "1px solid var(--c-line2)" }}>
          <Box w={30} h={30} r={999} />
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Box w={84} h={12} />
            <Box w={60} h={10} />
          </div>
        </div>
      </aside>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ background: "var(--c-glass)", borderBottom: "1px solid var(--c-line2)", padding: "16px 28px", display: "flex", flexDirection: "column", gap: 7 }}>
          <Box w={150} h={20} />
          <Box w={260} h={12} />
        </header>
        <div style={{ padding: "26px 28px 60px", overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-tab content skeletons
// ---------------------------------------------------------------------------

export function DashboardSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) 1fr", gap: 20, alignItems: "start" }}>
      <Card style={{ padding: "28px 26px" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 18px" }}>
          <Box w={200} h={200} r={999} />
        </div>
        <Box w={90} h={12} style={{ margin: "0 auto 16px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <Box w={80} h={12} />
              <Box h={6} r={3} />
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Card style={{ minHeight: 200 }}>
          <Box w={120} h={16} style={{ marginBottom: 18 }} />
          <Box h={120} r={10} />
        </Card>
        <Card>
          <Box w={140} h={16} style={{ marginBottom: 14 }} />
          <Box h={44} r={10} />
        </Card>
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div style={{ maxWidth: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
      <Card style={{ display: "flex", gap: 28, alignItems: "center", padding: "30px 32px" }}>
        <Box w={200} h={200} r={999} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <Box w="70%" h={26} />
          <Box w="90%" h={14} />
          {[0, 1, 2].map((i) => (
            <Box key={i} h={10} r={5} />
          ))}
        </div>
      </Card>
      {[0, 1, 2].map((i) => (
        <Card key={i} style={{ display: "flex", gap: 15, alignItems: "flex-start" }}>
          <Box w={26} h={26} r={7} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Box w="55%" h={15} />
            <Box w="85%" h={12} />
          </div>
          <Box w={40} h={28} r={6} />
        </Card>
      ))}
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card style={{ minHeight: 230 }}>
        <Box w={130} h={16} style={{ marginBottom: 18 }} />
        <Box h={150} r={10} />
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {[0, 1].map((i) => (
          <Card key={i} style={{ minHeight: 130 }}>
            <Box w={120} h={15} style={{ marginBottom: 14 }} />
            <Box w="80%" h={12} />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Box w={110} h={16} style={{ marginBottom: 16 }} />
          {[0, 1, 2].map((j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
              <Box w={160} h={13} />
              <Box w={90} h={13} />
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

export function ActionsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Box w={260} h={14} />
        <div style={{ flex: 1 }} />
        <Box w={110} h={28} r={8} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} style={{ display: "flex", gap: 15, alignItems: "flex-start" }}>
          <Box w={26} h={26} r={7} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Box w="50%" h={15} />
            <Box w="80%" h={12} />
            <div style={{ display: "flex", gap: 7 }}>
              <Box w={70} h={20} r={6} />
              <Box w={60} h={20} r={6} />
            </div>
          </div>
          <Box w={70} h={48} r={8} />
        </Card>
      ))}
    </div>
  );
}

export function BillingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Box w={100} h={12} style={{ marginBottom: 12 }} />
        <Box w={80} h={22} style={{ marginBottom: 14 }} />
        {[0, 1, 2].map((i) => (
          <Box key={i} w="70%" h={13} style={{ marginTop: 8 }} />
        ))}
      </Card>
      <Card>
        <Box w={130} h={12} style={{ marginBottom: 16 }} />
        {[0, 1].map((i) => (
          <Box key={i} h={56} r={10} style={{ marginBottom: 10 }} />
        ))}
      </Card>
      <Card>
        <Box w={150} h={18} style={{ marginBottom: 16 }} />
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} h={14} style={{ marginTop: 12 }} />
        ))}
      </Card>
    </div>
  );
}
