"use client";

/**
 * EvidenceDrawer — the universal drill-down surface. One reusable right-side
 * panel that opens for ANY intel data point (keyword / theme / thread / pain)
 * and shows its evidence + context, so "every data point is clickable and
 * sourced" holds everywhere instead of being reimplemented per view.
 *
 * Honesty rules (never fabricate a citation):
 *  - keyword  → volume, intent, its theme, a Google-SERP EvidenceLink.
 *  - theme    → total volume, intent, the FULL keyword list (volume + intent
 *               badge per keyword) — a render of already-fetched data, no
 *               extra call.
 *  - thread   → title (EvidenceLink → the real thread url), surface, relative
 *               date, intent; the engagement line ("▲{score} · {comments}
 *               comments") renders ONLY when `activity` is present — a null
 *               activity (surface has no public API) shows NO line, never a
 *               fabricated count.
 *  - pain     → the text + verbatim quote when present, and an EvidenceLink
 *               to `sourceUrl` when a real per-pain source exists; when it
 *               doesn't, a muted "from N competitor review pages" fallback
 *               listing the page-level `sources` hosts — never a fabricated
 *               deep link into a specific review.
 *
 * Mechanics: built on @base-ui/react/dialog directly (not the centered
 * shadcn-styled components/ui/dialog) so the panel can slide in from the
 * right while keeping base-ui's a11y for free — focus moves into the panel
 * on open, is restored to the trigger on close, Esc + backdrop-click close,
 * `role="dialog"` + aria-label are set on the popup. Styled with the intel
 * kit's inline `--c-*` token idiom (this file lives beside kit.tsx), not
 * Tailwind, to match every other component in this directory.
 */
import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Badge, EvidenceLink, intentTone, type Tone } from "@/components/app/intel/kit";
import { relativeDate } from "@/components/app/intel/demand-view";

// ---------------------------------------------------------------------------
// Subject union — every drill-downable data point in the app funnels through
// this one tagged union so the drawer stays a single, reusable surface.
// ---------------------------------------------------------------------------
export type EvidenceSubject =
  | { kind: "keyword"; keyword: string; volume: number; intent: string | null; theme?: string }
  | { kind: "theme"; theme: string; totalVolume: number; intent: string; keywords: { keyword: string; volume: number; intent: string | null }[] }
  | { kind: "thread"; title: string; url: string; surface: string; theme: string; publishedAt?: string | null; intent?: number; activity?: { score: number; comments: number } | null }
  | { kind: "pain"; text: string; quote?: string; sourceUrl?: string; mentions?: number; sources?: string[] };

const fmt = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
const serpUrl = (keyword: string) => `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;

// ---------------------------------------------------------------------------
// Context — a Provider that renders children + the drawer, and a hook any
// descendant uses to open it with a subject.
// ---------------------------------------------------------------------------
interface EvidenceDrawerContextValue {
  open: (subject: EvidenceSubject) => void;
}

const EvidenceDrawerContext = React.createContext<EvidenceDrawerContextValue | null>(null);

export function useEvidenceDrawer(): EvidenceDrawerContextValue {
  const ctx = React.useContext(EvidenceDrawerContext);
  if (!ctx) throw new Error("useEvidenceDrawer must be used within an EvidenceDrawerProvider");
  return ctx;
}

export function EvidenceDrawerProvider({ children }: { children: React.ReactNode }) {
  const [subject, setSubject] = React.useState<EvidenceSubject | null>(null);
  const value = React.useMemo<EvidenceDrawerContextValue>(() => ({ open: (s) => setSubject(s) }), []);

  return (
    <EvidenceDrawerContext.Provider value={value}>
      {children}
      <DialogPrimitive.Root open={subject !== null} onOpenChange={(next) => { if (!next) setSubject(null); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(2px)",
              transition: "opacity 180ms ease",
            }}
            className="evidence-drawer-backdrop"
          />
          <DialogPrimitive.Popup
            aria-label={subject ? subjectAriaLabel(subject) : "Evidence"}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 61,
              width: "min(420px, 100vw)",
              background: "var(--c-surface)",
              borderLeft: "1px solid var(--c-line)",
              boxShadow: "var(--elevation-xl, 0 8px 30px rgba(0,0,0,0.2))",
              padding: "22px 24px",
              overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 14,
              transition: "transform 220ms ease, opacity 220ms ease",
            }}
            className="evidence-drawer-panel"
          >
            {subject && <DrawerBody subject={subject} onClose={() => setSubject(null)} />}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <style>{`
        .evidence-drawer-backdrop[data-starting-style],
        .evidence-drawer-backdrop[data-ending-style] { opacity: 0; }
        .evidence-drawer-panel[data-starting-style],
        .evidence-drawer-panel[data-ending-style] { transform: translateX(100%); opacity: 0; }
        @media (prefers-reduced-motion: reduce) {
          .evidence-drawer-backdrop, .evidence-drawer-panel { transition: none !important; }
        }
      `}</style>
    </EvidenceDrawerContext.Provider>
  );
}

function subjectAriaLabel(s: EvidenceSubject): string {
  switch (s.kind) {
    case "keyword": return `Evidence for keyword "${s.keyword}"`;
    case "theme": return `Evidence for theme "${s.theme}"`;
    case "thread": return `Evidence for thread "${s.title}"`;
    case "pain": return "Evidence for buyer pain point";
  }
}

function DrawerBody({ subject, onClose }: { subject: EvidenceSubject; onClose: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--c-faint)", textTransform: "uppercase" }}>
          {kindLabel(subject.kind)}
        </span>
        <DialogPrimitive.Close
          aria-label="Close"
          style={{
            background: "none", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)",
            width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--c-muted)", fontSize: 14, lineHeight: 1,
          }}
          onClick={onClose}
        >
          ✕
        </DialogPrimitive.Close>
      </div>
      {renderSubject(subject)}
    </div>
  );
}

function kindLabel(kind: EvidenceSubject["kind"]): string {
  switch (kind) {
    case "keyword": return "Keyword evidence";
    case "theme": return "Theme evidence";
    case "thread": return "Thread evidence";
    case "pain": return "Buyer pain evidence";
  }
}

// ---------------------------------------------------------------------------
// renderSubject — the per-kind switch. Every branch shows real data only;
// nothing shown here is invented (see the honesty rules in the file header).
// ---------------------------------------------------------------------------
export function renderSubject(subject: EvidenceSubject): React.ReactNode {
  switch (subject.kind) {
    case "keyword":
      return <KeywordEvidence subject={subject} />;
    case "theme":
      return <ThemeEvidence subject={subject} />;
    case "thread":
      return <ThreadEvidence subject={subject} />;
    case "pain":
      return <PainEvidence subject={subject} />;
  }
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--c-faint)", marginBottom: 4 }}>{children}</div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--c-ink)", margin: "0 0 12px" }}>{children}</h3>
);

function KeywordEvidence({ subject }: { subject: Extract<EvidenceSubject, { kind: "keyword" }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Title>{subject.keyword}</Title>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="neutral">{fmt(subject.volume)}/mo volume</Badge>
        {subject.intent && <Badge tone={intentTone(subject.intent) as Tone}>{subject.intent}</Badge>}
      </div>
      {subject.theme && (
        <div>
          <Label>Theme</Label>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--c-ink)" }}>{subject.theme}</span>
        </div>
      )}
      <div>
        <Label>Source</Label>
        <EvidenceLink href={serpUrl(subject.keyword)}>See live Google search results</EvidenceLink>
      </div>
    </div>
  );
}

function ThemeEvidence({ subject }: { subject: Extract<EvidenceSubject, { kind: "theme" }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Title>{subject.theme}</Title>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="neutral">{fmt(subject.totalVolume)}/mo total volume</Badge>
        <Badge tone={intentTone(subject.intent) as Tone}>{subject.intent}</Badge>
      </div>
      <div>
        <Label>Keywords in this theme ({subject.keywords.length})</Label>
        {subject.keywords.length === 0 ? (
          <Empty>No keywords surfaced for this theme.</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {subject.keywords.map((k, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: "var(--radius-xs)", background: "var(--c-fill)" }}>
                <EvidenceLink href={serpUrl(k.keyword)} style={{ fontSize: 12.5 }}>{k.keyword}</EvidenceLink>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-muted)" }}>{fmt(k.volume)}/mo</span>
                  {k.intent && <Badge tone={intentTone(k.intent) as Tone}>{k.intent}</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadEvidence({ subject }: { subject: Extract<EvidenceSubject, { kind: "thread" }> }) {
  const rel = relativeDate(subject.publishedAt ?? null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Title>{subject.title}</Title>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="blue">{subject.surface}</Badge>
        <Badge tone="neutral">{subject.theme}</Badge>
        {typeof subject.intent === "number" && <Badge tone="violet">intent {subject.intent}</Badge>}
      </div>
      <div>
        <Label>Posted</Label>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--c-ink)" }}>{rel ?? "date unknown"}</span>
      </div>
      {/* Honesty: engagement renders ONLY when real activity was fetched — no
          count at all (not a "0") when the surface has no public API. */}
      {subject.activity != null && (
        <div>
          <Label>Engagement</Label>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--c-ink)" }}>
            ▲{fmt(subject.activity.score)} · {fmt(subject.activity.comments)} comments
          </span>
        </div>
      )}
      <div>
        <Label>Source</Label>
        <EvidenceLink href={subject.url}>Open the thread</EvidenceLink>
      </div>
    </div>
  );
}

function PainEvidence({ subject }: { subject: Extract<EvidenceSubject, { kind: "pain" }> }) {
  const sources = subject.sources ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Title>{subject.text}</Title>
      {typeof subject.mentions === "number" && (
        <div style={{ display: "flex", gap: 8 }}>
          <Badge tone="amber">{subject.mentions} mention{subject.mentions === 1 ? "" : "s"}</Badge>
        </div>
      )}
      {subject.quote && (
        <div>
          <Label>Verbatim quote</Label>
          <blockquote style={{ margin: 0, padding: "10px 12px", borderLeft: "3px solid var(--c-line)", fontFamily: "var(--font-sans)", fontSize: 13, fontStyle: "italic", color: "var(--c-muted)" }}>
            “{subject.quote}”
          </blockquote>
        </div>
      )}
      <div>
        <Label>Source</Label>
        {subject.sourceUrl ? (
          <EvidenceLink href={subject.sourceUrl}>Open the specific review</EvidenceLink>
        ) : sources.length > 0 ? (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-faint)" }}>
            from {sources.length} competitor review page{sources.length === 1 ? "" : "s"} — {sources.join(", ")}
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-faint)" }}>
            source not captured for this pain point.
          </span>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-faint)", fontStyle: "italic" }}>{children}</div>;
}
