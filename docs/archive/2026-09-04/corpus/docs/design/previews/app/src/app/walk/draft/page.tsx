"use client";

import { useState } from "react";
import { Alert, Badge, Btn, Card, Divider, Tabs } from "@/components/registry/primitives";
import { CodeBlock, Textarea } from "@/components/proposed";
import { AppShell } from "@/components/walk/AppShell";
import { StateBar, WalkBanner } from "@/components/chrome/WalkBanner";
import { Mono, Note, Stop } from "@/components/chrome/sheet";
import { DRAFT } from "@/mock/data";

type View = "read" | "edit" | "edited";

export default function WalkDraft() {
  const [view, setView] = useState<View>("read");
  const [pane, setPane] = useState(0);
  const [body, setBody] = useState(DRAFT.bodyBlocks.join("\n\n"));

  const rendered = (
    <div className="stack-3">
      <p className="rk-h2">{DRAFT.title}</p>
      <div
        className="stack-2"
        style={{
          background: "var(--accent-bg)",
          border: "var(--border-hair) solid var(--accent-line)",
          borderRadius: "var(--r-field)",
          padding: "var(--s-3)",
        }}
      >
        <p className="t-sm">{DRAFT.groundedLine}</p>
        <p className="prov">{DRAFT.groundedSource}</p>
      </div>
      {DRAFT.bodyBlocks.map((b, i) => (
        <p key={i} className={i === 0 || i === 3 ? "rk-h4" : "t-sm dim"}>
          {b}
        </p>
      ))}
    </div>
  );

  return (
    <main className="pv-wrap">
      <WalkBanner
        screen="the draft view — behind 'Read the full page'"
        spec="BUILD §4.6 · full page render, grounding, claim check, Approve/Edit/Veto"
        primaryAction="[approve — owner's]"
        proposed={["Textarea", "CodeBlock", "TabBar"]}
      >
        <div style={{ marginTop: "var(--s-3)" }}>
          <StateBar states={["read", "edit", "edited"]} value={view} onChange={(s) => setView(s as View)} />
        </div>
      </WalkBanner>

      <Stop>
        <p style={{ margin: 0 }}>
          <strong>This is the one place in the product where LLM output appears</strong> (standing
          law 3), and it is always labelled. A preview renders the <em>shape</em> of generated
          content and never a sample of it: every block below is a bracketed label. Filler copy in
          a preview is exactly the defect rule 7.3 names, and it is worse here than anywhere else —
          a paragraph of plausible draft text in a design artifact is the thing that later gets
          mistaken for approved output.
        </p>
      </Stop>

      <AppShell current="Calendar">
        <div className="stack-4">
          <div className="row">
            <Btn label={DRAFT.back} variant="ghost" size="sm" />
          </div>

          <div className="between">
            <div className="row">
              <Badge tone="warn">Your review</Badge>
              {view === "edited" ? (
                <span className="prov">{DRAFT.claimDropped}</span>
              ) : (
                <Badge tone="ok">{DRAFT.claimBadge}</Badge>
              )}
            </div>
            <span className="prov">{DRAFT.generatedLabel}</span>
          </div>

          <Card verdict={<span className="rk-h3">[draft verdict — owner&rsquo;s]</span>} provenance={DRAFT.autosave}>
            {view === "read" ? (
              rendered
            ) : (
              <>
                {/* Two columns on desktop, tabbed on narrow — §4.6's owner
                    ruling, 28 Aug: a Markdown textarea with a live preview
                    pane, autosaved, no rich-text editor. THAT is the found
                    rule; the width is derived. It switches at
                    --breakpoint-xl, not --breakpoint-lg, because the shell
                    takes --w-sidebar back at lg and two editor columns
                    would then be 377px each — narrower than the panel
                    measure the product already commits to reading in. */}
                <div className="hidden xl:grid xl:grid-cols-2" style={{ gap: "var(--s-4)" }}>
                  <Textarea
                    label={DRAFT.editorLabel}
                    placeholder={DRAFT.editorPlaceholder}
                    value={body}
                    onChange={setBody}
                  />
                  <div className="stack-2">
                    <p className="eb">{DRAFT.previewLabel}</p>
                    <div className="sunk">{rendered}</div>
                  </div>
                </div>
                <div className="xl:hidden stack-3">
                  <Tabs tabs={[DRAFT.editorLabel, DRAFT.previewLabel]} selected={pane} onSelect={setPane} />
                  {pane === 0 ? (
                    <Textarea
                      label={DRAFT.editorLabel}
                      placeholder={DRAFT.editorPlaceholder}
                      value={body}
                      onChange={setBody}
                    />
                  ) : (
                    <div className="sunk">{rendered}</div>
                  )}
                </div>
              </>
            )}

            <Divider />

            <Alert tone="neutral" message={DRAFT.doNothing} />

            <div className="between">
              <Btn label={DRAFT.approve} />
              <div className="row">
                <Btn label={DRAFT.edit} variant="ghost" size="sm" />
                <Btn label={DRAFT.veto} variant="danger" size="sm" />
              </div>
            </div>
          </Card>

          <Card
            eyebrow="[copy-out eyebrow — owner&rsquo;s]"
            verdict={<span className="rk-h4">[copy-out verdict — owner&rsquo;s]</span>}
          >
            <CodeBlock lines={["[markdown copy block — the draft itself, not typed into a preview]"]} copyLabel="[copy label — owner&rsquo;s]" />
          </Card>
        </div>
      </AppShell>

      <Note>
        <p style={{ margin: 0 }}>
          <strong>The claim-check badge is a state, not decoration.</strong> Switch to{" "}
          <Mono>edited</Mono>: the badge is <em>gone</em>, replaced by one quiet line, because §4.6
          says an edited draft drops it until the check re-runs on save. The grounding highlight
          stays, because the fact survived the edit. Watching the badge disappear as you type is
          the thing a static sheet could only assert in a caption.
        </p>
      </Note>
      <Note>
        <p style={{ margin: 0 }}>
          Two proposed-not-registered components carry this screen and both wear their mark:{" "}
          <Mono>Textarea</Mono> (§4 gap 2 — §2.2&rsquo;s set has <Mono>input</Mono> and no
          multi-line control, so the editor cannot be built from the registered set at all) and{" "}
          <Mono>CodeBlock</Mono> (§4 gap 3). Neither may be built against in{" "}
          <Mono>src/</Mono> until it is registered and approved.
        </p>
      </Note>
    </main>
  );
}
