import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Progress", path: "/app/progress" });

// Placeholder — Phase 4 replaces this with the real Progress view (Discoverability
// Score history + what moved it). For now it renders a simple centered note so the
// route + nav entry work end-to-end.
export default function ProgressPage() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center", border: "1px dashed var(--c-line)", borderRadius: "var(--radius-xl)", background: "var(--c-surface)" }}>
      <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: 0 }}>Progress view — coming in this iteration.</p>
    </div>
  );
}
