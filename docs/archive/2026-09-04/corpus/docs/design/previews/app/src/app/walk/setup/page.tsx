"use client";

import { useState } from "react";
import { Num } from "@/components/Num";
import { Badge, Btn, Card, EmptyState, Steps, Toggle } from "@/components/registry/primitives";
import { StateBar, WalkBanner } from "@/components/chrome/WalkBanner";
import { Mono, Note, Stop } from "@/components/chrome/sheet";
import { SETUP } from "@/mock/data";

type View = "decide" | "no-suggestions" | "submitting" | "deep-pass" | "degraded";

export default function WalkSetup() {
  const [view, setView] = useState<View>("decide");
  const [picked, setPicked] = useState<string[]>(SETUP.competitors.suggested.slice(0, 3));
  const [autopilot, setAutopilot] = useState(true);
  const [hosted, setHosted] = useState(true);

  const toggle = (c: string) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length < 5 ? [...p, c] : p));

  const running = view === "deep-pass" || view === "degraded";

  return (
    <main className="pv-wrap">
      <WalkBanner
        screen="/setup — post-payment, once"
        spec="BUILD §4.3 · three decisions and one submit"
        primaryAction="[submit — owner's]"
      >
        <div style={{ marginTop: "var(--s-3)" }}>
          <StateBar
            states={["decide", "no-suggestions", "submitting", "deep-pass", "degraded"]}
            value={view}
            onChange={(s) => setView(s as View)}
          />
        </div>
      </WalkBanner>

      {/* --w-read is --breakpoint-md less 2 × --s-6 = 704px, which is
          exactly the 44rem this was pinned to. The value did not change;
          it acquired a name and a derivation. */}
      <div className="rk rk-main" style={{ borderRadius: "var(--r-box)" }}>
        <div className="stack-5" style={{ maxWidth: "var(--w-read)", margin: "0 auto" }}>
          <h1 className="rk-h1">{SETUP.head}</h1>

          {running ? (
            <Card
              verdict={<span className="rk-h3">[deep-pass head — owner&rsquo;s]</span>}
              provenance="[measured · date]"
            >
              <Steps steps={SETUP.progress} />
              {view === "degraded" ? (
                <>
                  <p className="explain">{SETUP.degraded}</p>
                  <EmptyState tone="neutral" message={SETUP.zeroProposals} />
                </>
              ) : null}
            </Card>
          ) : (
            <>
              {/* 1 · your market */}
              <Card
                eyebrow="[decision 1 — owner&rsquo;s]"
                verdict={
                  <span className="row">
                    <span className="rk-h3">{SETUP.market.label}</span>
                    <Badge tone="accent">{SETUP.market.chip}</Badge>
                  </span>
                }
              >
                <div className="row">
                  <Btn label={SETUP.market.change} variant="ghost" size="sm" />
                </div>
              </Card>

              {/* 2 · competitors */}
              <Card
                eyebrow="[decision 2 — owner&rsquo;s]"
                verdict={<span className="rk-h3">{SETUP.competitors.label}</span>}
                provenance={SETUP.competitors.hint}
              >
                {view === "no-suggestions" ? (
                  <EmptyState tone="neutral" message={SETUP.competitors.empty} />
                ) : (
                  <div className="row">
                    {SETUP.competitors.suggested.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`badge ${picked.includes(c) ? "tone-accent" : "tone-neutral"}`}
                        style={{ cursor: "pointer", borderWidth: "var(--border-hair)", borderStyle: "solid" }}
                        onClick={() => toggle(c)}
                      >
                        <Num>{c}</Num>
                      </button>
                    ))}
                  </div>
                )}
                <p className="explain">
                  <Num>{picked.length}</Num>/<Num>5</Num>
                </p>
              </Card>

              {/* 3 · mode + destination */}
              <Card
                eyebrow="[decision 3 — owner&rsquo;s]"
                verdict={<span className="rk-h3">{SETUP.mode.label}</span>}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: "var(--s-3)" }}>
                  <button
                    type="button"
                    className="rk-card rk-card-body"
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: autopilot ? "var(--accent)" : "var(--line)",
                      background: autopilot ? "var(--accent-bg)" : "var(--surface)",
                    }}
                    onClick={() => setAutopilot(true)}
                  >
                    <span className="rk-h4">{SETUP.mode.autopilot}</span>
                    <span className="explain">[autopilot line — owner&rsquo;s]</span>
                  </button>
                  <button
                    type="button"
                    className="rk-card rk-card-body"
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      borderColor: autopilot ? "var(--line)" : "var(--accent)",
                      background: autopilot ? "var(--surface)" : "var(--accent-bg)",
                    }}
                    onClick={() => setAutopilot(false)}
                  >
                    <span className="rk-h4">{SETUP.mode.copilot}</span>
                    <span className="explain">[copilot line — owner&rsquo;s]</span>
                  </button>
                </div>
                <div className="stack-2">
                  <Toggle label={SETUP.mode.hostedBlog} checked={hosted} onChange={setHosted} />
                  <Toggle label={SETUP.mode.wordpressLater} checked={!hosted} onChange={(v) => setHosted(!v)} />
                  {hosted ? (
                    <div className="sunk">
                      <p className="eb">{SETUP.mode.cnameKey}</p>
                      <p className="t-sm">
                        <Num>{SETUP.mode.cname}</Num>
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>

              <Btn label={SETUP.submit} block state={view === "submitting" ? "in-flight" : "default"} />
            </>
          )}
        </div>
      </div>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>Three cards, one submit, and no other configuration exists at setup.</strong> The
          engine tunes nothing here — caps, cadences, question counts and model choices are code
          constants, and §4.7 keeps them out of Settings too.
        </p>
      </Note>
      <Stop>
        <p style={{ margin: 0 }}>
          The <Mono>degraded</Mono> state is the one worth staring at:{" "}
          <strong>a degraded pass still releases setup, and zero proposals is legal and never
          faked</strong>. The empty state there takes <Mono>neutral</Mono> — its type will not
          accept <Mono>bad</Mono>, because §2.5 says an empty queue is a success state and finding
          nothing worth publishing is not the customer&rsquo;s failure.
        </p>
      </Stop>
    </main>
  );
}
