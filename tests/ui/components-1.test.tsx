// tests/ui/components-1.test.tsx
//
// WO-268 `## Test plan` — the five rows carried verbatim from WO-031 for
// the first eight of the fifteen registered components: Btn, Card, Badge,
// Alert, Stat, Tabs, Table, Progress. Criterion source: BP-018 and
// `BUILD.md`, not a requirement — BP-018 has no requirement ancestor.
//
// Each component is required-props-only by construction (BP-018 decision
// 2). Two halves, the same shape `tests/ui/surface.test.tsx` established:
// a compile-time half (`@ts-expect-error` fixtures below, discharged by
// `npm run typecheck` — `tsconfig.json` includes `tests/**/*.tsx`, so
// widening a prop to optional turns a directive into a reported "unused"
// error) and a runtime half (render every component with its required text
// prop(s) stripped, bypassing TypeScript deliberately via a documented
// cast, and assert no text renders at all — a fallback string would show
// up here and nowhere else does the runtime half of the promise get
// checked).
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Badge } from "@/ui/components/Badge";
import { Alert } from "@/ui/components/Alert";
import { Stat } from "@/ui/components/Stat";
import { Tabs } from "@/ui/components/Tabs";
import { Table } from "@/ui/components/Table";
import { Progress } from "@/ui/components/Progress";

const COMPONENTS_DIR = path.resolve(__dirname, "../../src/ui/components");

/** Renders a component with an arbitrary prop bag (deliberately untyped —
 * every call site below documents which required prop it is omitting) and
 * returns the rendered root element, parsed through jsdom the same way
 * `tests/ui/surface.test.tsx` does. */
function renderRoot(el: React.ReactElement): Element {
  const html = renderToStaticMarkup(el);
  const container = document.createElement("div");
  container.innerHTML = html;
  const root = container.firstElementChild;
  if (!root) throw new Error("component rendered no root element");
  return root;
}

function sourceOf(file: string): string {
  return readFileSync(path.join(COMPONENTS_DIR, `${file}.tsx`), "utf8");
}

/** Strips `//` line comments and `/* … *‍/` block comments so the prose scan
 * below reads only what actually ships, not this file plan's own citations
 * of `BUILD.md`/`components.md` prose inside header comments. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/** Every string/template literal in a stripped source, in declaration
 * order. */
function literalsOf(src: string): string[] {
  const out: string[] = [];
  const re = /"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[0]);
  return out;
}

// A denylist of English words a hardcoded default sentence would almost
// certainly contain, matched as whole words — deliberately not "any
// literal with a space," which would false-positive on multi-token
// className strings like Collapse's `"collapse collapse-arrow ..."`
// (`components.md` §1 names no wording for any of the fifteen).
const PROSE_MARKERS =
  /\b(the|is|are|please|click|submit|cancel|confirm|loading|error|success|fail|failed|empty|no data|required|invalid|select|choose|continue|retry|welcome|hello|thanks|enter|available)\b/i;

const ALL_COMPONENT_FILES = [
  "Btn",
  "Card",
  "Badge",
  "Alert",
  "Stat",
  "Tabs",
  "Table",
  "Progress",
  "Toggle",
  "Steps",
  "Join",
  "Collapse",
  "Input",
  "Divider",
  "Kbd",
];

describe(
  "BP-018 decision 2 — compile-time half: a required text prop omitted is a type error",
  () => {
    it("Btn without label is a type error", () => {
      // @ts-expect-error — `label` is required; omitting it must not compile.
      const el = <Btn />;
      expect(el).toBeTruthy();
    });

    it("Card without title/children is a type error", () => {
      // @ts-expect-error — `title` and `children` are required for `state: 'default'`.
      const el = <Card state="default" />;
      expect(el).toBeTruthy();
    });

    it("Badge without children is a type error", () => {
      // @ts-expect-error — `children` is required.
      const el = <Badge tone="ok" />;
      expect(el).toBeTruthy();
    });

    it("Alert without message is a type error", () => {
      // @ts-expect-error — `message` is required.
      const el = <Alert tone="ok" />;
      expect(el).toBeTruthy();
    });

    it("Stat measured without value/delta/goal is a type error", () => {
      // @ts-expect-error — `value` and one of `delta`/`goal` are required for `measured`.
      const el = <Stat state="measured" label="l" />;
      expect(el).toBeTruthy();
    });

    it("Tabs item without label is a type error", () => {
      const tabs: Array<{ id: string; label: string }> = [
        // @ts-expect-error — `label` is required on every tab item.
        { id: "a" },
      ];
      const el = <Tabs tabs={tabs} selectedId="a" />;
      expect(el).toBeTruthy();
    });

    it("Table without emptyMessage is a type error", () => {
      // @ts-expect-error — `emptyMessage` is required even when `rows` is non-empty.
      const el = <Table columns={[{ key: "a", header: "A" }]} rows={[]} />;
      expect(el).toBeTruthy();
    });

    it("Progress without value/max is a type error", () => {
      // @ts-expect-error — `value` and `max` are both required; neither is nullable.
      const el = <Progress />;
      expect(el).toBeTruthy();
    });

    it("Progress with max but no value is a type error (value alone is not optional)", () => {
      // @ts-expect-error — `value` is required even when `max` is supplied.
      const el = <Progress max={10} />;
      expect(el).toBeTruthy();
    });

    it("Progress with value but no max is a type error (max alone is not optional)", () => {
      // @ts-expect-error — `max` is required even when `value` is supplied.
      const el = <Progress value={5} />;
      expect(el).toBeTruthy();
    });
  }
);

describe('BP-018 decision 2: "no component has a default string"', () => {
  it("Btn renders no text when label is omitted", () => {
    const root = renderRoot(<Btn {...({} as { label: string })} />);
    expect(root.textContent).toBe("");
  });

  it("Card renders no text when title and children are omitted (default state)", () => {
    const root = renderRoot(
      <Card {...({ state: "default" } as unknown as React.ComponentProps<typeof Card>)} />
    );
    expect(root.textContent).toBe("");
  });

  it("Card renders no text when title and degradedLine are omitted (degraded state)", () => {
    const root = renderRoot(
      <Card {...({ state: "degraded" } as unknown as React.ComponentProps<typeof Card>)} />
    );
    expect(root.textContent).toBe("");
  });

  it("Badge renders no text when children is omitted", () => {
    const root = renderRoot(<Badge {...({ tone: "ok" } as { tone: "ok"; children: React.ReactNode })} />);
    expect(root.textContent).toBe("");
  });

  it("Alert renders no text when message is omitted", () => {
    const root = renderRoot(
      <Alert {...({ tone: "ok" } as { tone: "ok"; message: React.ReactNode })} />
    );
    expect(root.textContent).toBe("");
  });

  it("Stat renders no label/delta/goal text when omitted (measured state, value left bare too)", () => {
    const root = renderRoot(
      <Stat
        {...({ state: "measured" } as unknown as React.ComponentProps<typeof Stat>)}
      />
    );
    // The unmeasured em dash is a glyph, not prose (see file header); a
    // measured stat with everything omitted must carry no text at all.
    expect(root.textContent).toBe("");
  });

  it("Stat renders only the em dash (no reason sentence) when unmeasured's reason is omitted", () => {
    const root = renderRoot(
      <Stat
        {...({ state: "unmeasured" } as unknown as React.ComponentProps<typeof Stat>)}
      />
    );
    // Only the fixed glyph — no injected reason sentence.
    expect(root.textContent).toBe("—");
  });

  it("Tabs renders no tab label text when omitted", () => {
    const root = renderRoot(
      <Tabs
        tabs={[{ id: "a" } as unknown as { id: string; label: string }]}
        selectedId="a"
      />
    );
    expect(root.textContent).toBe("");
  });

  it("Table renders no header or empty-state text when omitted", () => {
    const root = renderRoot(
      <Table
        columns={[{ key: "a" } as unknown as { key: string; header: React.ReactNode }]}
        rows={[]}
        emptyMessage={undefined}
      />
    );
    expect(root.textContent).toBe("");
  });

  it("no component file below contains a string literal that reads as prose", () => {
    const offenders: Array<{ file: string; literal: string }> = [];
    for (const file of ALL_COMPONENT_FILES) {
      const stripped = stripComments(sourceOf(file));
      for (const literal of literalsOf(stripped)) {
        // A single class-name token (e.g. "alert-error", "collapse-arrow")
        // never contains whitespace; requiring a space before matching a
        // denylist word is what keeps daisyUI's own state-suffix classes
        // (`-error`, `-success`, …) from false-positiving here.
        if (/\s/.test(literal) && PROSE_MARKERS.test(literal)) offenders.push({ file, literal });
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('BP-018 decision 1: "daisyUI components only — no bespoke widgets"', () => {
  it("Btn's root carries the btn class", () => {
    const root = renderRoot(<Btn label="x" />);
    expect(root.classList.contains("btn")).toBe(true);
  });

  it("Card's root carries the card class, with card-body/card-title inside", () => {
    const root = renderRoot(
      <Card state="default" title="verdict">
        body
      </Card>
    );
    expect(root.classList.contains("card")).toBe(true);
    expect(root.querySelector(".card-body")).not.toBeNull();
    expect(root.querySelector(".card-title")).not.toBeNull();
  });

  it("Badge's root carries the badge class", () => {
    const root = renderRoot(<Badge tone="ok">x</Badge>);
    expect(root.classList.contains("badge")).toBe(true);
  });

  it("Alert's root carries the alert class", () => {
    const root = renderRoot(<Alert tone="ok" message="x" />);
    expect(root.classList.contains("alert")).toBe(true);
  });

  it("Stat's carryBeside puts the value and its carrier on one row, and leaves unmeasured stacked (#521)", () => {
    const beside = renderRoot(<Stat state="measured" label="l" value={62} delta="+8" carryBeside />);
    const row = beside.querySelector('[data-carry="beside"]');
    expect(row?.querySelector(".stat-value")?.textContent).toBe("62");
    expect(row?.querySelector(".stat-desc")?.textContent).toBe("+8");
    expect(row?.className).toContain("flex-wrap");
    const stacked = renderRoot(<Stat state="measured" label="l" value={62} delta="+8" />);
    expect(stacked.querySelector('[data-carry="beside"]')).toBeNull();
    const unmeasured = renderRoot(<Stat state="unmeasured" label="l" reason="not yet" carryBeside />);
    expect(unmeasured.querySelector('[data-carry="beside"]')).toBeNull();
    expect(unmeasured.querySelector(".stat-desc")?.textContent).toBe("not yet");
  });

  it("Stat's root carries the stats class, with a stat element inside", () => {
    const root = renderRoot(
      <Stat state="measured" label="l" value={1} delta="+1" />
    );
    expect(root.classList.contains("stats")).toBe(true);
    expect(root.querySelector(".stat")).not.toBeNull();
  });

  // ── issue #211 ────────────────────────────────────────────────────────
  it("Stat's desc overrides daisyUI's nowrap, in the component and in both states", () => {
    // daisyUI's own `.stat-desc` is `white-space: nowrap`, which suits a
    // delta or a goal and is wrong for `unmeasured`'s `reason` — a written
    // line this component's type makes required. Unwrappable, that sentence
    // sets the grid column's max-content width and the tile grows past its
    // containing block at every width (#211). The override belongs here and
    // nowhere else: a per-screen fix would leave every other caller of this
    // component with the same defect.
    for (const props of [
      { state: "measured", label: "l", value: 1, delta: "+1" },
      {
        state: "unmeasured",
        label: "Searches you appear in",
        reason: "Searches you appear in wasn’t measured — the scan stopped early, before it got there.",
      },
    ] as const) {
      const desc = renderRoot(<Stat {...props} />).querySelector(".stat-desc");
      expect(desc, `${props.state}: no .stat-desc rendered`).not.toBeNull();
      expect(
        desc?.classList.contains("whitespace-normal"),
        `${props.state}: .stat-desc must override daisyUI's nowrap`
      ).toBe(true);
    }
  });

  it("Tabs' root carries the tabs class", () => {
    const root = renderRoot(
      <Tabs tabs={[{ id: "a", label: "A" }]} selectedId="a" />
    );
    expect(root.classList.contains("tabs")).toBe(true);
  });

  it("Table's root carries table-wrap (overflow-x-auto), with a table element inside", () => {
    const root = renderRoot(
      <Table columns={[{ key: "a", header: "A" }]} rows={[]} emptyMessage="none" />
    );
    expect(root.classList.contains("overflow-x-auto")).toBe(true);
    expect(root.querySelector("table.table")).not.toBeNull();
  });

  it("Progress's root carries the progress class", () => {
    const root = renderRoot(<Progress value={5} max={10} />);
    expect(root.classList.contains("progress")).toBe(true);
  });

  it("none of the eight components renders an inline style attribute (no bespoke layout CSS)", () => {
    for (const file of ["Btn", "Card", "Badge", "Alert", "Stat", "Tabs", "Table", "Progress"]) {
      expect(sourceOf(file), file).not.toMatch(/\bstyle=/);
    }
  });
});

describe(
  '`BUILD.md` §2.2: "`table` (+zebra, always inside an `overflow-x-auto` wrap)"',
  () => {
    it("Table always renders the overflow-x-auto wrap as its root, with no prop to omit it", () => {
      const root = renderRoot(
        <Table columns={[{ key: "a", header: "A" }]} rows={[{ a: "1" }]} emptyMessage="none" />
      );
      expect(root.tagName.toLowerCase()).toBe("div");
      expect(root.classList.contains("overflow-x-auto")).toBe(true);
    });

    it("Table.tsx's props type has no field that can suppress the wrap", () => {
      const src = sourceOf("Table");
      expect(src).not.toMatch(/wrap\??:\s*(boolean|false)/);
    });

    it("Table never renders a skeleton: no loading prop exists on the component", () => {
      const src = stripComments(sourceOf("Table"));
      expect(src).not.toMatch(/loading/i);
      expect(src).not.toMatch(/skeleton/i);
    });

    it("Table's empty state renders the caller-supplied written line, never a built-in one", () => {
      const root = renderRoot(
        <Table columns={[{ key: "a", header: "A" }]} rows={[]} emptyMessage="No campaigns yet — mock reason" />
      );
      expect(root.textContent).toContain("No campaigns yet — mock reason");
    });
  }
);

describe(
  'BP-018 error behaviour: "Every numeral … renders in JetBrains Mono with `tabular-nums`; a numeral in the UI font is a defect."',
  () => {
    it("Stat's value slot carries the .num class", () => {
      const root = renderRoot(<Stat state="measured" label="l" value={62} delta="+7" />);
      const valueEl = root.querySelector(".stat-value");
      expect(valueEl).not.toBeNull();
      expect(valueEl!.classList.contains("num")).toBe(true);
    });

    it("Stat's unmeasured value slot also carries .num (the em dash renders through it too)", () => {
      const root = renderRoot(<Stat state="unmeasured" label="l" reason="no data collected" />);
      const valueEl = root.querySelector(".stat-value");
      expect(valueEl!.classList.contains("num")).toBe(true);
      expect(valueEl!.textContent).toBe("—");
    });
  }
);

describe(
  "BP-018 public interface / REQ-004 c4 words-not-colour rule: Badge and Alert each require a text child",
  () => {
    it("Badge.tsx types `children` as required, not optional", () => {
      const src = sourceOf("Badge");
      expect(src).toMatch(/children:\s*React\.ReactNode;/);
      expect(src).not.toMatch(/children\?:/);
    });

    it("Alert.tsx types `message` as required, not optional", () => {
      const src = sourceOf("Alert");
      expect(src).toMatch(/message:\s*React\.ReactNode;/);
      expect(src).not.toMatch(/message\?:/);
    });

    it("a Badge with a tone and a real text child renders that text, not a colour-only chip", () => {
      const root = renderRoot(<Badge tone="bad">0/12</Badge>);
      expect(root.textContent).toBe("0/12");
    });

    it("an Alert with a tone and a real message renders that message, not a colour-only bar", () => {
      const root = renderRoot(<Alert tone="bad" message="Measurement failed" />);
      expect(root.textContent).toBe("Measurement failed");
    });
  }
);
