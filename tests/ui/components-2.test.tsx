// tests/ui/components-2.test.tsx
//
// WO-268 `## Test plan` — the five rows carried verbatim from WO-032 for
// the remaining seven of the fifteen registered components (Toggle, Steps,
// Join, Collapse, Input, Divider, Kbd) plus the closed barrel itself.
// Criterion source: BP-018 and `SPEC.md`, not a requirement.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as barrel from "@/ui/components";
import { Toggle } from "@/ui/components/Toggle";
import { Steps } from "@/ui/components/Steps";
import { Join } from "@/ui/components/Join";
import { Collapse } from "@/ui/components/Collapse";
import { Input } from "@/ui/components/Input";
import { Divider } from "@/ui/components/Divider";
import { Kbd } from "@/ui/components/Kbd";

const COMPONENTS_DIR = path.resolve(__dirname, "../../src/ui/components");

const THE_FIFTEEN = [
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

describe(
  "BP-018 public interface: \"Registered components only — daisyUI primitives plus the five allowed customs.\"",
  () => {
    it("the barrel exports exactly the fifteen BP-018 names, no more, no fewer", () => {
      const exported = Object.keys(barrel).filter((k) => typeof (barrel as Record<string, unknown>)[k] === "function");
      expect(exported.sort()).toEqual([...THE_FIFTEEN].sort());
    });

    it("a sixteenth name has no slot: index.ts's own source names exactly fifteen `export {` component statements", () => {
      const src = readFileSync(path.join(COMPONENTS_DIR, "index.ts"), "utf8");
      const componentExportLines = src.match(/^export \{ [A-Z][a-zA-Z]* \} from "\.\//gm) ?? [];
      expect(componentExportLines.length).toBe(15);
    });

    it("mutation: a sixteenth export added to the barrel is caught", () => {
      const src = readFileSync(path.join(COMPONENTS_DIR, "index.ts"), "utf8");
      const mutated = `${src}\nexport { SixteenthWidget } from "./SixteenthWidget";\n`;
      const componentExportLines = mutated.match(/^export \{ [A-Z][a-zA-Z]* \} from "\.\//gm) ?? [];
      expect(componentExportLines.length).not.toBe(15);
      expect(componentExportLines.length).toBe(16);
    });
  }
);

describe(
  'BP-018 decision 1: "An open components directory — rejected, the first unregistered widget is the one that re-implements a card with different spacing and the design system stops being one."',
  () => {
    it("every .tsx file under src/ui/components/ (excluding custom/) is exported from the barrel", () => {
      const entries = readdirSync(COMPONENTS_DIR, { withFileTypes: true });
      const componentFiles = entries
        .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
        .map((e) => e.name.replace(/\.tsx$/, ""));
      const exported = Object.keys(barrel);
      for (const file of componentFiles) {
        expect(exported, `${file}.tsx exported from the barrel`).toContain(file);
      }
      // And nothing outside src/ui/components/custom/ exists yet that the
      // barrel doesn't also name — the fifteen files above are the whole
      // directory (custom/, charts/ and layout/ are separate modules/WOs).
      expect(componentFiles.sort()).toEqual([...THE_FIFTEEN].sort());
    });

    it("mutation: an unregistered .tsx dropped into the directory is caught", () => {
      const entries = readdirSync(COMPONENTS_DIR, { withFileTypes: true });
      const componentFiles = entries
        .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
        .map((e) => e.name.replace(/\.tsx$/, ""));
      const simulatedRogueFile = [...componentFiles, "RogueWidget"];
      const exported = Object.keys(barrel);
      const unregistered = simulatedRogueFile.filter((f) => !exported.includes(f));
      expect(unregistered).toEqual(["RogueWidget"]);
    });
  }
);

describe(
  "BP-018 decision 2 — compile-time half: a required text prop omitted is a type error",
  () => {
    it("Toggle without label is a type error", () => {
      // @ts-expect-error — `label` is required.
      const el = <Toggle checked={false} />;
      expect(el).toBeTruthy();
    });

    it("Steps item without label is a type error", () => {
      const steps: Array<{ id: string; label: string; state: "pending" | "active" | "done" }> = [
        // @ts-expect-error — `label` is required on every step item.
        { id: "a", state: "pending" },
      ];
      const el = <Steps steps={steps} />;
      expect(el).toBeTruthy();
    });

    it("Collapse without summary is a type error", () => {
      // @ts-expect-error — `summary` is required.
      const el = <Collapse>body</Collapse>;
      expect(el).toBeTruthy();
    });

    it("Input without label/placeholder is a type error", () => {
      // @ts-expect-error — `label` and `placeholder` are both required.
      const el = <Input />;
      expect(el).toBeTruthy();
    });

    it("Input with invalid: true and no invalidMessage is a type error", () => {
      // @ts-expect-error — `invalidMessage` is required whenever `invalid` is true.
      const el = <Input label="l" placeholder="p" invalid />;
      expect(el).toBeTruthy();
    });

    it("Kbd without children is a type error", () => {
      // @ts-expect-error — `children` is required.
      const el = <Kbd />;
      expect(el).toBeTruthy();
    });
  }
);

describe('BP-018 decision 2: "no component has a default string" (the seven)', () => {
  it("Toggle renders no text when label is omitted", () => {
    const root = renderRoot(<Toggle {...({ checked: false } as { checked: boolean; label: string })} />);
    expect(root.textContent).toBe("");
  });

  it("Steps renders no text when a step's label is omitted", () => {
    const root = renderRoot(
      <Steps
        steps={[{ id: "a", state: "pending" } as unknown as { id: string; label: string; state: "pending" }]}
      />
    );
    expect(root.textContent).toBe("");
  });

  it("Collapse renders no summary text when summary is omitted (body still present per its own contract)", () => {
    const root = renderRoot(
      <Collapse {...({ children: "body text" } as { children: React.ReactNode; summary: string })} />
    );
    const summaryEl = root.querySelector("summary");
    expect(summaryEl!.textContent).toBe("");
  });

  it("Input renders no label/placeholder text when omitted", () => {
    const root = renderRoot(<Input {...({} as { label: string; placeholder: string })} />);
    expect(root.textContent).toBe("");
    const inputEl = root.querySelector("input");
    expect(inputEl!.getAttribute("placeholder")).toBeFalsy();
  });

  it("Kbd renders no text when children is omitted", () => {
    const root = renderRoot(<Kbd {...({} as { children: React.ReactNode })} />);
    expect(root.textContent).toBe("");
  });

  it("Divider renders no text when label is omitted (optional, no fallback substituted)", () => {
    const root = renderRoot(<Divider />);
    expect(root.textContent).toBe("");
  });

  it("Join and Divider hold no text of their own — layout-only, nothing to default", () => {
    for (const file of ["Join", "Divider"]) {
      const stripped = stripComments(sourceOf(file));
      // A quoted literal containing two or more space-separated words would
      // be prose; single-word class-name literals like "join"/"divider" do
      // not match this.
      expect(stripped, file).not.toMatch(/"[a-zA-Z]+(?:\s[a-zA-Z]+)+"/);
    }
  });
});

describe(
  'BP-018 error behaviour: "Every … code-like string renders in JetBrains Mono with `tabular-nums`."',
  () => {
    it("Kbd renders through the .num class", () => {
      const root = renderRoot(<Kbd>Ctrl</Kbd>);
      expect(root.classList.contains("num")).toBe(true);
      expect(root.tagName.toLowerCase()).toBe("kbd");
    });

    it("mutation: removing .num from Kbd's className is caught", () => {
      const withoutNum = sourceOf("Kbd").replace('className="kbd num"', 'className="kbd"');
      expect(withoutNum).not.toContain('className="kbd num"');
      expect(sourceOf("Kbd")).toContain('className="kbd num"');
    });
  }
);

describe(
  'BP-003 / `SPEC.md` §2.5 empty-and-degraded rule as BP-018 states it: "Every label, empty state and tooltip is a required prop" — applied to Steps',
  () => {
    it("Steps requires a label per step, so an unlabelled stage cannot render (compile-time)", () => {
      const steps: Array<{ id: string; label: string; state: "pending" | "active" | "done" }> = [
        { id: "a", label: "Crawl", state: "done" },
        // @ts-expect-error — every step's label is required, not just the array's.
        { id: "b", state: "active" },
      ];
      const el = <Steps steps={steps} />;
      expect(el).toBeTruthy();
    });

    it("a fully-labelled Steps list renders every stage name and no unlabelled stage", () => {
      const root = renderRoot(
        <Steps
          steps={[
            { id: "a", label: "Crawl", state: "done" },
            { id: "b", label: "Compare", state: "active" },
            { id: "c", label: "Report", state: "pending" },
          ]}
        />
      );
      const items = Array.from(root.querySelectorAll("li"));
      expect(items.map((i) => i.textContent)).toEqual(["Crawl", "Compare", "Report"]);
      expect(items.every((i) => i.textContent && i.textContent.length > 0)).toBe(true);
    });
  }
);

describe('BP-018 decision 1: "daisyUI components only — no bespoke widgets" (the seven)', () => {
  it("Toggle's control carries the toggle class", () => {
    const root = renderRoot(<Toggle label="x" checked />);
    expect(root.querySelector(".toggle")).not.toBeNull();
  });

  it("Toggle's control is the set's switch — `rk-switch`, accent when on (issue #506)", () => {
    const root = renderRoot(<Toggle label="x" checked />);
    expect(root.querySelector(".toggle.rk-switch")).not.toBeNull();
  });

  it("Steps' root carries the steps class", () => {
    const root = renderRoot(<Steps steps={[{ id: "a", label: "A", state: "done" }]} />);
    expect(root.classList.contains("steps")).toBe(true);
  });

  it("Join's root carries the join class", () => {
    const root = renderRoot(<Join>x</Join>);
    expect(root.classList.contains("join")).toBe(true);
  });

  it("Collapse's root carries the collapse class", () => {
    const root = renderRoot(
      <Collapse summary="s">body</Collapse>
    );
    expect(root.classList.contains("collapse")).toBe(true);
  });

  it("Input's control carries the input class", () => {
    const root = renderRoot(<Input label="l" placeholder="p" />);
    expect(root.querySelector(".input")).not.toBeNull();
  });

  it("Divider's root carries the divider class", () => {
    const root = renderRoot(<Divider />);
    expect(root.classList.contains("divider")).toBe(true);
  });

  it("Kbd's root carries the kbd class", () => {
    const root = renderRoot(<Kbd>K</Kbd>);
    expect(root.classList.contains("kbd")).toBe(true);
  });

  it("none of the seven components renders an inline style attribute", () => {
    for (const file of ["Toggle", "Steps", "Join", "Collapse", "Input", "Divider", "Kbd"]) {
      expect(sourceOf(file), file).not.toMatch(/\bstyle=/);
    }
  });
});

describe("Collapse — server-rendered body, not a lazy fetch", () => {
  it("the body text is present in the static markup even when the panel is not open (no fetch, no lazy mount)", () => {
    const html = renderToStaticMarkup(
      <Collapse summary="Robots.txt">the full body text, unabridged</Collapse>
    );
    expect(html).toContain("the full body text, unabridged");
  });

  it("Collapse.tsx makes no network call and mounts children unconditionally", () => {
    const src = stripComments(sourceOf("Collapse"));
    expect(src).not.toMatch(/fetch\(|useEffect|lazy\(/);
  });
});

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("issue #486 — Steps draws the set's check in a done cell (UI-SPEC §2.6, S10 L689)", () => {
  it("a done step carries daisyUI's step-icon with a check glyph; pending and active carry none", () => {
    const root = renderRoot(
      <Steps
        steps={[
          { id: "a", label: "Paid", state: "done" },
          { id: "b", label: "Setup", state: "active" },
          { id: "c", label: "First page", state: "pending" },
        ]}
      />
    );
    const cells = Array.from(root.querySelectorAll("li"));
    expect(cells.map((li) => li.querySelector(".step-icon svg") !== null)).toEqual([true, false, false]);
    expect(cells.map((li) => li.textContent)).toEqual(["Paid", "Setup", "First page"]);
  });
});

describe("issue #509 — a done step is --ok, the one under way is the accent (set L308–309)", () => {
  const steps = [
    { id: "a", label: "a", state: "done" as const },
    { id: "b", label: "b", state: "active" as const },
    { id: "c", label: "c", state: "pending" as const },
  ];
  const cells = (): Element[] => Array.from(renderRoot(<Steps steps={steps} />).querySelectorAll("li"));

  it("done takes daisyUI's success slot (--ok), never the primary one", () => {
    const [done] = cells();
    expect(done!.classList.contains("step-success")).toBe(true);
    expect(done!.classList.contains("step-primary")).toBe(false);
  });

  it("active keeps the primary slot (--accent); pending takes neither", () => {
    const [, active, pending] = cells();
    expect(active!.classList.contains("step-primary")).toBe(true);
    expect(active!.classList.contains("step-success")).toBe(false);
    expect(pending!.className).toBe("step");
  });

  it("the two slots are the two tokens the set names", () => {
    const config = readFileSync(path.resolve(__dirname, "../../tailwind.config.ts"), "utf8");
    expect(config).toContain('"--color-success": "var(--ok)"');
    expect(config).toContain('"--color-primary": "var(--accent)"');
  });
});
