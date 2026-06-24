"use client";

/**
 * ScanningScreen — the captured "scanning" screen (ReachKit.dc.html): a violet
 * spinner with a live %, headline, and a step-log card. Design-adopted to the
 * app's REAL narrative steps (state + label) and host. 1:1 styling.
 */

const SG = "Space Grotesk", JM = "JetBrains Mono";

export interface ScanStep { state: "done" | "active" | "pending"; label: string }

export function ScanningScreen({ host, steps }: { host: string | null; steps: ScanStep[] }) {
  const done = steps.filter((s) => s.state === "done").length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(900px 500px at 50% 30%, #F4F0FF, #fff)" }}>
      <style>{`@keyframes rk-spin{to{transform:rotate(360deg)}}@keyframes rk-pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <div style={{ width: "min(560px, 92vw)", textAlign: "center", padding: 32 }}>
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 28px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid #ECE7FB" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid", borderColor: "#6E56F7 transparent transparent", animation: "rk-spin 1s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, fontWeight: 700, fontSize: 26, color: "#6E56F7" }}>{pct}%</div>
        </div>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>Scanning {host ?? "your site"}</h2>
        <p style={{ fontSize: 15, color: "#8A8794", margin: "8px 0 28px" }}>Reading your page the way a customer&apos;s search does…</p>
        <div style={{ textAlign: "left", background: "#fff", border: "1px solid #ECEAF3", borderRadius: 14, padding: 10, boxShadow: "rgba(40,33,84,0.18) 0px 10px 30px -12px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {steps.map((s, i) => {
              const active = s.state === "active";
              const isDone = s.state === "done";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, background: active ? "#F7F5FF" : "transparent", opacity: s.state === "pending" ? 0.4 : 1, transition: "0.25s" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: isDone || active ? "#6E56F7" : "#ECEAF3", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                    {isDone ? "✓" : active ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "rk-pulse 1s ease infinite" }} /> : null}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: active || isDone ? 600 : 500, color: active || isDone ? "#14131A" : "#9A97A5" }}>{s.label}</span>
                  {active && <span style={{ marginLeft: "auto", fontFamily: JM, fontSize: 12, color: "#6E56F7" }}>…</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
