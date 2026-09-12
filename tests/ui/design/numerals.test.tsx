// tests/ui/design/numerals.test.tsx — §2.3
//
// §2.3, verbatim: "**Every numeral, date, URL, search query and code-like
// string is JetBrains Mono with `tabular-nums`.**"
//
// `.num` (`src/ui/type.css`) is the one carrier of that rule, and
// `tests/ui/fonts.test.ts` already fixes it as the only rule in the design
// system that binds `var(--font-mono)`. What was never swept is the other
// half: that a numeral cannot reach the screen *outside* it. Every
// registered component and both §2.2 customs are rendered here with a
// numeral in every slot that can hold one, and every digit in the output
// has to sit inside a `.num` element.
//
// A component holds numerals in one of two ways, and the two are checked
// differently because they are different promises:
//
//   * **The component owns the numeral.** `Stat`'s value and
//     `CalendarGrid`'s date are rendered by the component into an element
//     it puts `.num` on, so the caller passes a bare number and the mono
//     face is not the caller's to forget.
//   * **The caller owns it**, through a `React.ReactNode` slot. The
//     promise there is that the component renders the caller's node as it
//     is — so a `.num` wrapper survives, is not replaced, and is not
//     re-wrapped in something that overrides it.
//
// Seven components have neither: every text slot they take is typed
// `string`, so no numeral can enter them in mono at all. That is asserted
// as the fact it is (they render no digit), and flagged rather than fixed
// — widening a prop to `ReactNode` is a change to BP-018's component
// contracts, not a conformance repair.
//
// The five charts are not swept here: `tests/ui/charts.test.tsx` already
// asserts "every numeral a chart writes is in the mono utility (§2.3)"
// over the same closed inventory.
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Alert } from "@/ui/components/Alert";
import { Badge } from "@/ui/components/Badge";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Collapse } from "@/ui/components/Collapse";
import { Divider } from "@/ui/components/Divider";
import { Input } from "@/ui/components/Input";
import { Join } from "@/ui/components/Join";
import { Progress } from "@/ui/components/Progress";
import { Stat } from "@/ui/components/Stat";
import { Steps } from "@/ui/components/Steps";
import { Table } from "@/ui/components/Table";
import { Tabs } from "@/ui/components/Tabs";
import { Toggle } from "@/ui/components/Toggle";
import { CalendarGrid, type CalendarGridCell } from "@/ui/components/custom/CalendarGrid";
import { DayPanel, DayPanelLayout } from "@/ui/components/custom/DayPanel";
import { REGISTERED } from "./vocabulary";

/** A numeral the caller owns, in the mono utility — what a screen writes
 *  when it puts a number into a `React.ReactNode` slot. */
const N = (text: string): React.JSX.Element => <span className="num">{text}</span>;

function parse(el: React.JSX.Element): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

/** Every text node under `root` that holds a digit, paired with whether
 *  some ancestor carries `.num`. */
function digitBearingText(root: Element): Array<{ text: string; mono: boolean }> {
  const out: Array<{ text: string; mono: boolean }> = [];
  const walk = (node: Node, mono: boolean): void => {
    const here =
      mono || (node instanceof Element && node.classList.contains("num"));
    if (node.nodeType === node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (/\d/.test(text)) out.push({ text, mono: here });
      return;
    }
    for (const child of Array.from(node.childNodes)) walk(child, here);
  };
  walk(root, false);
  return out;
}

/* ── the fixtures ─────────────────────────────────────────────────────── */

const CELL: CalendarGridCell = {
  id: "d-14",
  date: "14",
  entry: { label: "A page about onboarding", stage: "Draft", tone: "accent" },
  emptyLine: null,
  today: false,
  selected: false,
  placeholder: false,
};

/** Every registered component, plus §2.2's two custom components, with a
 *  numeral in every slot that can carry one. `string` slots are given
 *  digit-free text on purpose: a `string` cannot carry a mono wrapper, so
 *  putting a numeral there would assert a rule the contract cannot keep. */
const FIXTURES: Record<string, () => React.JSX.Element> = {
  // The component owns the numeral.
  Stat: () => <Stat state="measured" label="AI answers" value={12} delta={N("+3")} />,
  CalendarGrid: () => (
    <CalendarGrid weekdays={["Mon", "Tue"]} cells={[CELL]} onSelect={() => undefined} />
  ),

  // The caller owns it, through a node slot.
  Card: () => (
    <Card state="default" title={<Badge tone="bad">{N("0/12")}</Badge>}>
      {N("158")}
    </Card>
  ),
  Badge: () => <Badge tone="ok">{N("9/12")}</Badge>,
  Alert: () => <Alert tone="warn" message={N("3")} />,
  Table: () => (
    <Table
      columns={[{ key: "wk", header: N("2026") }]}
      rows={[{ wk: N("158") }]}
      emptyMessage={N("0")}
      zebra
    />
  ),
  Join: () => <Join>{N("1")}</Join>,
  Divider: () => <Divider label={N("7")} />,
  DayPanel: () => <DayPanel heading={N("14")} account={N("2")} actions={N("1")} />,
  DayPanelLayout: () => <DayPanelLayout grid={N("30")} panel={N("1")} />,

  // No slot a numeral can enter in mono: every text slot is a `string`.
  Btn: () => <Btn label="Run the scan" variant="primary" />,
  Toggle: () => <Toggle label="Weekly summary" checked onChange={() => undefined} />,
  Steps: () => <Steps steps={[{ id: "a", label: "Reading the site", state: "done" }]} />,
  Tabs: () => <Tabs tabs={[{ id: "a", label: "Overview" }]} selectedId="a" />,
  Collapse: () => <Collapse summary="What was measured">A written line.</Collapse>,
  Input: () => <Input label="Your domain" placeholder="acme.example" />,
  Progress: () => <Progress value={3} max={12} />,
};

const STRING_SLOTTED_ONLY = ["Btn", "Toggle", "Steps", "Tabs", "Collapse", "Input", "Progress"];

const RENDERS_A_NUMERAL = Object.keys(FIXTURES).filter(
  (name) => !STRING_SLOTTED_ONLY.includes(name)
);

/* ── the sweep ────────────────────────────────────────────────────────── */

describe('§2.3 — "Every numeral … is JetBrains Mono with `tabular-nums`"', () => {
  it("the sweep covers every registered component and both §2.2 customs", () => {
    for (const component of REGISTERED) {
      expect(Object.keys(FIXTURES), component.exported).toContain(component.exported);
    }
    expect(Object.keys(FIXTURES)).toContain("CalendarGrid");
    expect(Object.keys(FIXTURES)).toContain("DayPanel");
  });

  it.each(Object.keys(FIXTURES))("%s: every digit it renders is inside .num", (name) => {
    const fixture = FIXTURES[name];
    expect(fixture, name).toBeDefined();
    const stray = digitBearingText(parse((fixture as () => React.JSX.Element)()))
      .filter((hit) => !hit.mono)
      .map((hit) => hit.text.trim());
    expect(stray, `${name} renders a numeral outside .num`).toEqual([]);
  });

  it.each(RENDERS_A_NUMERAL)("%s: the fixture is not vacuous — a numeral did render", (name) => {
    const fixture = FIXTURES[name];
    expect(fixture, name).toBeDefined();
    const digits = digitBearingText(parse((fixture as () => React.JSX.Element)()));
    expect(digits.length, name).toBeGreaterThan(0);
  });
});

describe("the components that supply the mono carrier themselves", () => {
  it("Stat's value is mono without the caller asking — a bare number renders in .num", () => {
    const root = parse(<Stat state="measured" label="AI answers" value={12} delta="+3" />);
    const value = root.querySelector(".stat-value");
    expect(value?.classList.contains("num")).toBe(true);
    expect(value?.textContent).toBe("12");
  });

  it("CalendarGrid's date is mono without the caller asking", () => {
    const root = parse(
      <CalendarGrid weekdays={["Mon"]} cells={[CELL]} onSelect={() => undefined} />
    );
    const date = root.querySelector(".rk-cal-date");
    expect(date?.classList.contains("num")).toBe(true);
    expect(date?.textContent).toBe("14");
  });
});

describe("the components the caller supplies the mono carrier to", () => {
  it("a caller's .num node survives every node slot — it is rendered, not rebuilt", () => {
    for (const name of ["Card", "Badge", "Alert", "Table", "Join", "Divider", "DayPanel"]) {
      const fixture = FIXTURES[name];
      expect(fixture, name).toBeDefined();
      const root = parse((fixture as () => React.JSX.Element)());
      expect(root.querySelectorAll(".num").length, name).toBeGreaterThan(0);
    }
  });

  it("mutation: a numeral passed into a node slot without .num is caught", () => {
    const root = parse(<Badge tone="ok">9/12</Badge>);
    const stray = digitBearingText(root).filter((hit) => !hit.mono);
    expect(stray.map((hit) => hit.text)).toEqual(["9/12"]);
  });

  it("mutation: a component that wrapped a caller's node in a non-mono element is caught", () => {
    // What the sweep would see if `Badge` rendered `{children}` inside its
    // own span and dropped the caller's class on the way.
    const root = parse(
      <span className="badge">
        <span>9/12</span>
      </span>
    );
    expect(digitBearingText(root).filter((hit) => !hit.mono)).toHaveLength(1);
  });
});

describe("the seven components no numeral can enter in mono", () => {
  it.each(STRING_SLOTTED_ONLY)("%s renders no digit of its own", (name) => {
    const fixture = FIXTURES[name];
    expect(fixture, name).toBeDefined();
    expect(digitBearingText(parse((fixture as () => React.JSX.Element)()))).toEqual([]);
  });

  it("Progress carries its numbers as attributes, where no font applies", () => {
    const root = parse(<Progress value={3} max={12} />);
    const progress = root.querySelector("progress");
    expect(progress?.getAttribute("value")).toBe("3");
    expect(progress?.getAttribute("max")).toBe("12");
    expect(progress?.textContent).toBe("");
  });
});
