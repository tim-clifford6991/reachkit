/**
 * ActionsMain — the captured app "Actions" tab (queue summary + onboarding
 * banner + Open list with Mark-done), converted 1:1 and wired to live actions.
 * Renders inside the captured AppShell. (Mark-done interactivity reuses the
 * existing action flow — wired in a follow-up; the list + state are live.)
 */

import { MarkDoneButton } from "./mark-done-button";

const SG = "Space Grotesk", JM = "JetBrains Mono";

function effortColors(effort: string) {
  if (/\$0|free/i.test(effort)) return { bg: "var(--c-tint-green)", fg: "#1F9D5B" };
  if (/quick/i.test(effort)) return { bg: "var(--c-tint-blue)", fg: "#3B6FE0" };
  return { bg: "var(--c-tint-amber)", fg: "#C98A12" };
}

export interface OpenAction { id: string; rank: number; title: string; why: string; effort: string; pillar: string; pred: number }
export interface ActionsMainProps {
  doneSummary: string;
  refreshLabel: string;
  showOnboarding: boolean;
  open: OpenAction[];
}

export function ActionsMain(p: ActionsMainProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 13.5, color: "var(--c-muted)", fontWeight: 500 }}>{p.doneSummary}</div>
        <div style={{ flex: "1 1 0%" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-action)", background: "var(--c-soft)", padding: "6px 12px", borderRadius: 8 }}>{p.refreshLabel}</span>
      </div>

      {p.showOnboarding && (
        <div style={{ background: "linear-gradient(120deg, #F4F0FF, var(--c-tint-violet))", border: "1px solid #E7E0FB", borderRadius: 14, padding: "18px 20px", marginBottom: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 22 }}>👋</span>
          <div style={{ flex: "1 1 0%" }}>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG }}>Mark your first fix done to feel the loop</div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginTop: 2 }}>Pick any action → Mark done → we re-fetch your page → your score moves. That&apos;s the whole product.</div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Open · {p.open.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}>
        {p.open.map((a) => {
          const ec = effortColors(a.effort);
          return (
            <div key={a.rank} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 15 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: ec.bg, color: ec.fg, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, flex: "0 0 auto", marginTop: 1 }}>{a.rank}</span>
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div>
                <div style={{ fontSize: 13, color: "var(--c-faint)", marginTop: 3 }}>{a.why}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: ec.fg, background: ec.bg, padding: "3px 9px", borderRadius: 6 }}>{a.effort}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: 6 }}>{a.pillar}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 600 }}>Predicted</div>
                <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 17, color: "#1F9D5B" }}>+{a.pred}</div>
                <MarkDoneButton actionId={a.id} />
              </div>
            </div>
          );
        })}
      </div>

      {p.open.length === 0 && (
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, padding: "40px 20px", textAlign: "center", fontSize: 14, color: "var(--c-muted)" }}>
          🎉 Queue cleared for this week. New actions arrive with your next scan.
        </div>
      )}
    </div>
  );
}
