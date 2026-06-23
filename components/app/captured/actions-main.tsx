/**
 * ActionsMain — the captured app "Actions" tab (queue summary + onboarding
 * banner + Open list with Mark-done), converted 1:1 and wired to live actions.
 * Renders inside the captured AppShell. (Mark-done interactivity reuses the
 * existing action flow — wired in a follow-up; the list + state are live.)
 */

import { MarkDoneButton } from "./mark-done-button";

const SG = "Space Grotesk", JM = "JetBrains Mono";

function effortColors(effort: string) {
  if (/\$0|free/i.test(effort)) return { bg: "#EAF7EF", fg: "#1F9D5B" };
  if (/quick/i.test(effort)) return { bg: "#EAF1FF", fg: "#3B6FE0" };
  return { bg: "#FFF4E0", fg: "#C98A12" };
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
        <div style={{ fontSize: 13.5, color: "#56535F", fontWeight: 500 }}>{p.doneSummary}</div>
        <div style={{ flex: "1 1 0%" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#6E56F7", background: "#F2EEFF", padding: "6px 12px", borderRadius: 8 }}>{p.refreshLabel}</span>
      </div>

      {p.showOnboarding && (
        <div style={{ background: "linear-gradient(120deg, #F4F0FF, #FAF8FF)", border: "1px solid #E7E0FB", borderRadius: 14, padding: "18px 20px", marginBottom: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 22 }}>👋</span>
          <div style={{ flex: "1 1 0%" }}>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: SG }}>Mark your first fix done to feel the loop</div>
            <div style={{ fontSize: 13, color: "#56535F", marginTop: 2 }}>Pick any action → Mark done → we re-fetch your page → your score moves. That&apos;s the whole product.</div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "#9A97A5", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Open · {p.open.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}>
        {p.open.map((a) => {
          const ec = effortColors(a.effort);
          return (
            <div key={a.rank} style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 15 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: ec.bg, color: ec.fg, fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, flex: "0 0 auto", marginTop: 1 }}>{a.rank}</span>
              <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div>
                <div style={{ fontSize: 13, color: "#8A8794", marginTop: 3 }}>{a.why}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: ec.fg, background: ec.bg, padding: "3px 9px", borderRadius: 6 }}>{a.effort}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56535F", background: "#F4F2FA", padding: "3px 9px", borderRadius: 6 }}>{a.pillar}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div style={{ fontSize: 11, color: "#9A97A5", fontWeight: 600 }}>Predicted</div>
                <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 17, color: "#1F9D5B" }}>+{a.pred}</div>
                <MarkDoneButton actionId={a.id} />
              </div>
            </div>
          );
        })}
      </div>

      {p.open.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #ECEAF3", borderRadius: 14, padding: "40px 20px", textAlign: "center", fontSize: 14, color: "#56535F" }}>
          🎉 Queue cleared for this week. New actions arrive with your next scan.
        </div>
      )}
    </div>
  );
}
