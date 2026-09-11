"use client";

import { useState } from "react";
import { Num } from "@/components/Num";
import {
  Alert,
  Badge,
  Btn,
  Card,
  Collapse,
  Divider,
  EmptyState,
  Input,
  Join,
  Kbd,
  Progress,
  Stat,
  Steps,
  Table,
  Tabs,
  Toggle,
} from "@/components/registry/primitives";
import { Mono, Note, P, ScrollX, Section, SheetHead, Stage, Stop, Sub } from "@/components/chrome/sheet";
import { REPORT } from "@/mock/data";

export default function PrimitivesPage() {
  const [tab, setTab] = useState(0);
  const [auto, setAuto] = useState(true);
  const [domain, setDomain] = useState("");

  return (
    <main className="pv-wrap">
      <SheetHead
        title="The fifteen registered primitives — live"
        carries="WO-031 (primitives) + WO-032 · both unsigned · every components.md §1 row is proposed"
      >
        <P>
          Every state <Mono>components.md</Mono> records, drawn as running components. Two rules
          hold across all fifteen and are visible in the types, not just in prose: no component
          holds copy — every label is a required prop with no default — and structure is
          daisyUI&rsquo;s class while tone is a named token.
        </P>
      </SheetHead>

      <Section n="1" title="Btn">
        <P>
          Also carries the copy-to-clipboard affordance. No <Mono>CopyButton</Mono> is registered
          and none should be — three surfaces each want one, and it is this.
        </P>
        <Stage label="default · disabled · in-flight · ghost · small · block · destructive">
          <div className="stack-3">
            <div className="row-3">
              <Btn label="[primary — owner&rsquo;s]" />
              <Btn label="[disabled — owner&rsquo;s]" state="disabled" />
              <Btn label="[in-flight — owner&rsquo;s]" state="in-flight" />
              <Btn label="[ghost — owner&rsquo;s]" variant="ghost" />
              <Btn label="[small — owner&rsquo;s]" variant="ghost" size="sm" />
              <Btn label="[destructive — owner&rsquo;s]" variant="danger" size="sm" />
            </div>
            <Btn label="[block — owner&rsquo;s]" block />
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            <strong>In-flight is a disabled submit, not a spinner.</strong> Hover and focus are now
            judgeable, which no static sheet showed: tab through the row and the daisyUI focus ring
            is the one the tokens define.
          </p>
        </Note>
      </Section>

      <Section n="2" title="Card">
        <P>
          The title slot takes a <strong>verdict node</strong>, not a metric label — §2.5: the card
          leads with the answer. Degraded renders one written line in place of a missing section:
          never an empty card, never a spinner.
        </P>
        <Stage label="default · degraded">
          <div className="stack-3">
            <Card
              eyebrow="[card eyebrow]"
              verdict={
                <span className="row" style={{ alignItems: "baseline" }}>
                  <span className="rk-num-big">
                    <Num>62</Num>
                  </span>
                  <Badge tone="ok">
                    <Num>▲ 8</Num>
                  </Badge>
                </span>
              }
              provenance="[measured · date]"
            >
              <p className="explain">[explanatory line — owner&rsquo;s]</p>
            </Card>
            <Card
              eyebrow="[card eyebrow]"
              verdict={<span className="rk-h3">[degraded verdict — owner&rsquo;s]</span>}
              degraded="[missing-driver line — owner&rsquo;s]"
              provenance="[measured · date]"
            />
          </div>
        </Stage>
        <Stop>
          <p style={{ margin: 0 }}>
            <Mono>Card</Mono> has <strong>no registered loading state and no registered empty
            state</strong> (components.md §6). Neither is invented here.
          </p>
        </Stop>
      </Section>

      <Section n="3" title="Badge">
        <P>Requires a text child — a tone alone may never carry meaning.</P>
        <Stage label="the five tones, each with its required child">
          <div className="row-3">
            <Badge tone="neutral">[neutral]</Badge>
            <Badge tone="accent">[accent]</Badge>
            <Badge tone="ok">[ok]</Badge>
            <Badge tone="warn">[warn]</Badge>
            <Badge tone="bad">[bad]</Badge>
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            Stage chip, verdict chip, band badge, claim badge and source chip are all this, each
            with its required text child. None of them is a registry row and none should become one.
            <strong> A rival&rsquo;s strength outside a chart takes neutral, never bad</strong> —
            enforced in <Mono>tone.ts</Mono> by a type with one member.
          </p>
        </Note>
      </Section>

      <Section n="4" title="Alert">
        <P>
          Four tones. <Mono>message</Mono> required; no default empty-state sentence exists.
        </P>
        <Stage label="the tones, and the empty state that may not be red">
          <div className="stack-2">
            <Alert tone="neutral" message="[neutral alert — owner&rsquo;s]" />
            <Alert tone="ok" message="[ok alert — owner&rsquo;s]" />
            <Alert tone="warn" message="[warn alert — owner&rsquo;s]" action={<Btn label="[action]" size="sm" variant="ghost" />} />
            <Alert tone="bad" message="[bad alert — owner&rsquo;s]" />
            <EmptyState tone="ok" message="[empty-queue line — owner&rsquo;s]" />
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            §2.5: <em>an empty queue is a success state</em>. The palette permits the defect and
            prose cannot refuse it — so <Mono>EmptyState</Mono>&rsquo;s tone type admits{" "}
            <Mono>neutral</Mono> and <Mono>ok</Mono> and nothing else.{" "}
            <Mono>tone=&quot;bad&quot;</Mono> on an empty queue does not compile. That is a thing
            live code can do and a sheet cannot: the rule stops being a note and becomes a build
            failure.
          </p>
        </Note>
      </Section>

      <Section n="5" title="Stat">
        <P>
          Value renders through the mono numeral utility. One headline number per module; every
          value carries its delta <em>or</em> its goal, never bare — written as a union, so a bare
          value has no representation to pass.
        </P>
        <Stage label="measured · measured-zero · unmeasured">
          <div className="row-3" style={{ alignItems: "flex-start", gap: "var(--s-6)" }}>
            <Stat label="[tile label]" state="measured" value="62" delta={<Badge tone="ok"><Num>▲ 8</Num></Badge>} />
            <Stat label="[tile label]" state="measured-zero" delta={<Badge tone="neutral">[no change]</Badge>} />
            <Stat
              label="[tile label]"
              state="unmeasured"
              unmeasuredAccount="[measurement failed line — owner&rsquo;s]"
              goal={<Badge tone="neutral">[goal label]</Badge>}
            />
          </div>
        </Stage>
        <Note>
          <p style={{ margin: 0 }}>
            <Mono>measured-zero</Mono> prints <Num>0</Num> and is a <em>measurement</em>, never an
            error — it takes no red. <Mono>unmeasured</Mono> prints an em dash plus one written
            line naming the reason.
          </p>
        </Note>
      </Section>

      <Section n="6" title="Tabs">
        <P>Boxed + bordered. Every tab label required.</P>
        <Stage label="default · selected — click one">
          <Tabs tabs={["[tab 1]", "[tab 2]", "[tab 3]"]} selected={tab} onSelect={setTab} />
        </Stage>
      </Section>

      <Section n="7" title="Table">
        <P>
          Always inside an <Mono>overflow-x-auto</Mono> wrap — the wrap is part of the component,
          not the caller&rsquo;s job. Drag the frame narrower and the wrap is what you are judging.
        </P>
        <Stage label="rows · empty (caller-supplied written line)">
          <div className="stack-3">
            <Table
              columns={["search", "/mo", "holds #1"]}
              rows={REPORT.absent.map((r) => [<Num key="a">{r[0]}</Num>, <Num key="b">{r[1]}</Num>, r[2]])}
              empty={REPORT.absentEmpty}
            />
            <Table columns={["search", "/mo", "holds #1"]} rows={[]} empty={REPORT.absentEmpty} />
          </div>
        </Stage>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>Never a skeleton</strong>, and no loading state is registered — so this
            component takes no <Mono>loading</Mono> prop. The usual answer is ruled out and no
            replacement is named. That hole is components.md §6, unclosed.
          </p>
        </Stop>
      </Section>

      <Section n="8" title="Progress">
        <P>
          <strong>Determinate only.</strong> <Mono>value</Mono> and <Mono>max</Mono> are both
          required and neither is nullable: an indeterminate bar cannot be requested. This is also
          the three driver mini-bars of the report header strip — not a sixth chart.
        </P>
        <Stage label="the report header's three drivers">
          <div className="stack-2" style={{ maxWidth: "var(--w-day-panel)" }}>
            {REPORT.drivers.map((d) => (
              <Progress key={d.label} label={d.label} value={d.value} max={d.max} />
            ))}
          </div>
        </Stage>
      </Section>

      <Section n="9" title="Toggle">
        <P>Label required; no default on/off wording.</P>
        <Stage label="on · off · disabled">
          <div className="stack-2">
            <Toggle label="[toggle label — owner&rsquo;s]" checked={auto} onChange={setAuto} />
            <Toggle label="[toggle label — owner&rsquo;s]" checked={false} onChange={() => undefined} />
            <Toggle label="[toggle label — owner&rsquo;s]" checked disabled />
          </div>
        </Stage>
      </Section>

      <Section n="10" title="Steps">
        <P>
          Each step&rsquo;s label is required — this is what a scan&rsquo;s named stages render
          through, so an unlabelled step cannot exist. REQ-003 c1 forbids an unlabelled spinner and
          an indeterminate bar alone, and this is the registered answer.
        </P>
        <Stage label="pending · active · done">
          <Steps steps={REPORT.scanning} />
        </Stage>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>A stage that failed has no state.</strong> components.md §6 records it and this
            sheet does not invent it — a state invented in a preview is a contract nobody agreed.
          </p>
        </Stop>
      </Section>

      <Section n="11" title="Join">
        <P>Layout only.</P>
        <Stage label="a joined control group">
          <Join>
            <button type="button" className="btn join-item btn-ghost">
              [prev]
            </button>
            <button type="button" className="btn join-item btn-ghost">
              [month]
            </button>
            <button type="button" className="btn join-item btn-ghost">
              [next]
            </button>
          </Join>
        </Stage>
      </Section>

      <Section n="12" title="Collapse">
        <P>
          Summary text required. Server-rendered body, not a lazy fetch — REQ-009 c6 is readable
          without JavaScript, so this is a <Mono>&lt;details&gt;</Mono>, which is.
        </P>
        <Stage label="collapsed · expanded">
          <div className="stack-2">
            <Collapse summary={REPORT.diy[0]}>
              <p className="explain">{REPORT.diyBody}</p>
            </Collapse>
            <Collapse summary={REPORT.diy[1]} open>
              <p className="explain">{REPORT.diyBody}</p>
            </Collapse>
          </div>
        </Stage>
      </Section>

      <Section n="13" title="Input">
        <P>Placeholder and label required, never defaulted.</P>
        <Stage label="default · invalid (value intact) · disabled">
          <div className="stack-3" style={{ maxWidth: "var(--w-day-panel)" }}>
            <Input label="[input label]" placeholder="[placeholder — owner&rsquo;s]" value={domain} onChange={setDomain} />
            <Input
              label="[input label]"
              placeholder="[placeholder — owner&rsquo;s]"
              value="[the value the customer typed, kept]"
              state="invalid"
              invalidAccount="[invalid line — owner&rsquo;s]"
              onChange={() => undefined}
            />
            <Input label="[input label]" placeholder="[placeholder — owner&rsquo;s]" state="disabled" value="" onChange={() => undefined} />
          </div>
        </Stage>
      </Section>

      <Section n="14" title="Divider">
        <P>Layout only.</P>
        <Stage label="a rule between two blocks">
          <div>
            <p className="explain">[block above]</p>
            <Divider />
            <p className="explain">[block below]</p>
          </div>
        </Stage>
      </Section>

      <Section n="15" title="Kbd">
        <P>
          Renders through the mono utility — a code-like string under §2.3. <strong>Inline only</strong>;
          it is not a code block. The block the report needs is <Mono>proposed</Mono>, and lives on{" "}
          <Mono>/walk/report</Mono> marked as such.
        </P>
        <Stage label="inline">
          <p className="t-sm">
            [instruction — owner&rsquo;s] <Kbd>⌘K</Kbd>
          </p>
        </Stage>
      </Section>

      <Section n="16" title="State coverage against rule 7.3">
        <P>
          Rule 7.3 requires every data view to specify loading, empty and error. Six of the fifteen
          are data views, and this is what is actually registered.
        </P>
        <ScrollX>
        <table className="pv-table">
          <thead>
            <tr>
              <th>Data view</th>
              <th>Loading</th>
              <th>Empty</th>
              <th>Error / degraded</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="m">Card</td><td style={{ color: "var(--pv-stop)" }}>not registered</td><td style={{ color: "var(--pv-stop)" }}>not registered</td><td>degraded</td></tr>
            <tr><td className="m">Alert</td><td>n/a</td><td>the empty state IS an Alert; neutral or ok</td><td>warn/bad, message required</td></tr>
            <tr><td className="m">Stat</td><td style={{ color: "var(--pv-stop)" }}>not registered</td><td>measured-zero — a measurement, not an empty</td><td>unmeasured</td></tr>
            <tr><td className="m">Table</td><td style={{ color: "var(--pv-stop)" }}>not registered, and &ldquo;never a skeleton&rdquo; rules out the usual answer</td><td>caller-supplied written line</td><td style={{ color: "var(--pv-stop)" }}>not registered</td></tr>
            <tr><td className="m">Progress</td><td>determinate only — refused by contract</td><td>n/a</td><td>n/a</td></tr>
            <tr><td className="m">Steps</td><td>active, every stage named</td><td>n/a</td><td style={{ color: "var(--pv-stop)" }}>a stage that failed has no state</td></tr>
          </tbody>
        </table>
        </ScrollX>
        <Stop>
          <p style={{ margin: 0 }}>
            <strong>No registered primitive carries a loading state.</strong> <Mono>Steps</Mono> is
            the only registered component that shows work in progress at all, and it does so by
            naming stages — right wherever the stages are known. Where they are not, the registry
            has nothing, and <Mono>Progress</Mono> refuses to be it by its own rule. A proposed
            answer is drawn on <Mono>/surfaces</Mono> §7 and is in no component&rsquo;s States cell.
          </p>
        </Stop>
      </Section>

      <Section n="17" title="Deliberately not drawn">
        <Sub title="Because it is not registered" />
        <P>
          A multi-line control, a code block, an indeterminate &ldquo;still running&rdquo;
          affordance and a narrow-viewport tab bar are components.md §4 gaps 2–5. Three of them are
          built in this app under <Mono>src/components/proposed/</Mono> and every one carries a{" "}
          <Mono>proposed</Mono> mark on screen wherever it appears. The fourth — the indeterminate
          affordance — is <strong>not built</strong>: resolving it to <Mono>Steps</Mono> or adding a
          row is a decision, and drawing a fourth option would paper over it.
        </P>
      </Section>
    </main>
  );
}
