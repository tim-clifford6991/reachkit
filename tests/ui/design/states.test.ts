// UI-SPEC §0 — the owner's sixteen rulings of 2026-09-11 (issue #530).
//
// Each `it` names the ruling it holds. The states are asserted on the
// stylesheets that carry them — the registered components' own classes in
// `idiom.css`, `calendar-grid.css` and `shell.css` — because §0 says they
// live there and never per screen; a screen that restyled one would be a
// second definition this file does not see, which is the point.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { widths } from "../layout/widths";
import { APPROVED_TOKENS_CSS, THEME_CSS, tokenSet } from "./tokens-doc";

const REPO = path.resolve(import.meta.dirname, "../../..");
const SRC = path.join(REPO, "src");
const read = (rel: string): string => readFileSync(path.join(REPO, rel), "utf8");

const IDIOM = "src/ui/idiom/idiom.css";
const CALENDAR = "src/ui/components/custom/calendar-grid.css";
const SHELL = "src/ui/layout/shell.css";

function walk(dir: string, keep: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, keep, out);
    else if (keep(full)) out.push(full);
  }
  return out;
}

/** The declarations of the top-level rule whose selector list contains
 *  `selector` exactly, merged in source order (a later rule wins). */
function decls(file: string, selector: string): Map<string, string> {
  const out = new Map<string, string>();
  postcss.parse(read(file)).walkRules((rule: Rule) => {
    if (rule.parent?.type === "atrule") return;
    const list = rule.selectors.map((s) => s.replace(/\s+/g, " ").trim());
    if (!list.includes(selector)) return;
    rule.walkDecls((d: Declaration) => {
      out.set(d.prop, d.value.trim());
    });
  });
  if (out.size === 0) throw new Error(`${file}: no rule for "${selector}"`);
  return out;
}

describe("§0 1–3 — Btn pressed, disabled and the warn hover", () => {
  it("§0 1: each rank's :active is its own hover ground, and nothing moves", () => {
    expect(decls(IDIOM, ".btn.rk-btn-outline:is(:hover, :active)").get("background")).toBe(
      "var(--accent-bg)"
    );
    expect(decls(IDIOM, ".btn.rk-btn-tertiary:is(:hover, :active)").get("background")).toBe(
      "var(--sunk)"
    );
    expect(decls(IDIOM, ".btn.btn-primary:is(:hover, :active)").get("filter")).toBe(
      "brightness(1.08)"
    );
    const active = decls(IDIOM, ".btn:active");
    expect(active.get("translate")).toBe("none");
    expect(active.get("transform")).toBe("none");
  });

  it("§0 2: disabled, all four ranks — --ink-3 on --sunk, a --line edge, default cursor", () => {
    for (const selector of [
      ".btn:disabled",
      ".btn.btn-primary:disabled",
      ".btn.rk-btn-outline:disabled",
      ".btn.rk-btn-tertiary:disabled",
      ".btn.rk-btn-outline[data-tone]:disabled",
    ]) {
      const d = decls(IDIOM, selector);
      expect(d.get("background"), selector).toBe("var(--sunk)");
      expect(d.get("color"), selector).toBe("var(--ink-3)");
      expect(d.get("border"), selector).toBe("1px solid var(--line)");
      expect(d.get("cursor"), selector).toBe("default");
      expect(d.get("filter"), selector).toBe("none");
    }
  });

  it("§0 3: the warn outline fills with --warn-bg on hover", () => {
    expect(
      decls(IDIOM, '.btn.rk-btn-outline[data-tone="warn"]:is(:hover, :active)').get("background")
    ).toBe("var(--warn-bg)");
  });
});

describe("§0 4–5 — the field's disabled and invalid states", () => {
  it("§0 4: a disabled field is --sunk ground with --ink-3 text", () => {
    const d = decls(IDIOM, ".input:disabled");
    expect(d.get("background")).toBe("var(--sunk)");
    expect(d.get("color")).toBe("var(--ink-3)");
  });

  it("§0 4: S10's market card is not dimmed as a whole", () => {
    const form = read("src/app/(account)/setup/SetupForm.tsx");
    expect(form).not.toMatch(/\{\s*opacity:\s*0?\.6\s*\}/);
    expect(form).not.toMatch(/\bDIMMED\b/);
  });

  it("§0 5: an invalid field's edge is --bad, keyed on aria-invalid, never a class", () => {
    expect(decls(IDIOM, '.input[aria-invalid="true"]').get("border-color")).toBe("var(--bad)");
    const input = read("src/ui/components/Input.tsx");
    expect(input).toContain("aria-invalid={p.invalid === true}");
    expect(input).not.toContain("input-error");
  });
});

describe("§0 6–9 — switch, option card, tag and collapse", () => {
  it("§0 6: a disabled switch is the --line track at half strength, its label --ink-3", () => {
    const d = decls(IDIOM, ".toggle:disabled");
    expect(d.get("background")).toBe("var(--line)");
    expect(d.get("opacity")).toBe("0.5");
    expect(decls(IDIOM, "label:has(> .toggle:disabled)").get("color")).toBe("var(--ink-3)");
  });

  it("§0 7: a disabled option card is --sunk, --line, default cursor, over hover too", () => {
    for (const selector of [".rk-choice:disabled", ".rk-choice:disabled:hover"]) {
      const d = decls(IDIOM, selector);
      expect(d.get("background"), selector).toBe("var(--sunk)");
      expect(d.get("border-color"), selector).toBe("var(--line)");
      expect(d.get("cursor"), selector).toBe("default");
    }
    expect(read("src/ui/idiom/OptionCard.tsx")).toContain("disabled={p.disabled}");
  });

  it("§0 8: hover raises the tag's × and leaves the tag's ground alone", () => {
    expect(decls(IDIOM, ".rk-tag:hover .rk-tag-x").get("opacity")).toBe("1");
    expect(read(IDIOM)).not.toMatch(/\.rk-tag:hover\s*\{/);
  });

  it("§0 9: the collapse summary takes --sunk on hover", () => {
    expect(decls(IDIOM, ".collapse > .collapse-title:hover").get("background")).toBe(
      "var(--sunk)"
    );
  });
});

describe("§0 10 — the calendar cell open in the panel", () => {
  it("keeps the hover ring, and today keeps its own", () => {
    expect(decls(CALENDAR, ".rk-cal-cell:hover").get("border-color")).toBe("var(--accent-line)");
    const open = decls(CALENDAR, ".rk-cal-cell.rk-cal-selected");
    expect(open.get("border-color")).toBe("var(--accent-line)");
    expect(open.has("background"), "the open cell is a ring, not a ground").toBe(false);
    expect(decls(CALENDAR, ".rk-cal-cell.rk-cal-today").get("box-shadow")).toContain(
      "var(--shadow-card)"
    );
  });

  it('carries aria-current="date", and no longer aria-pressed', () => {
    const grid = read("src/ui/components/custom/CalendarGrid.tsx");
    expect(grid).toContain('aria-current={cell.selected ? "date" : undefined}');
    expect(grid).not.toContain("aria-pressed={cell.selected}");
  });
});

describe("§0 11 — the compact band keeps the Workspace nav as one row", () => {
  it("the compact header renders the sidebar's own nav as a row, and no tab bar", () => {
    const layout = read("src/app/(account)/app/layout.tsx");
    expect(layout).toContain("<SidebarNav waiting={shell.waiting} row />");
    expect(layout).not.toMatch(/TabBar/);
  });

  it("the row is horizontal and nothing in the shell sheet hides it", () => {
    expect(decls(SHELL, ".rk-nav-row").get("flex-direction")).toBe("row");
    const hidden: string[] = [];
    postcss.parse(read(SHELL)).walkRules((rule: Rule) => {
      const hides = rule.nodes.some(
        (n) => n.type === "decl" && n.prop === "display" && n.value.trim() === "none"
      );
      if (hides && /rk-nav|rk-navlink/.test(rule.selector)) hidden.push(rule.selector);
    });
    expect(hidden).toEqual([]);
  });
});

describe("§0 12 — footer links", () => {
  it("underline on hover, as .linkish", () => {
    expect(decls(IDIOM, ".rk-chrome-foot-in nav a:hover").get("text-decoration")).toBe(
      "underline"
    );
  });
});

describe("§0 13 — one motion token", () => {
  it("--motion-fast is .18s in all three blocks of both token files", () => {
    for (const file of [APPROVED_TOKENS_CSS, THEME_CSS]) {
      const set = tokenSet(file);
      for (const block of ["light", "dark-media", "dark-toggle"] as const) {
        expect(set[block].get("--motion-fast"), `${path.basename(file)} ${block}`).toBe(".18s");
      }
    }
  });

  it("nothing else in src declares a transition duration, and only the ruled properties move", () => {
    const ALLOWED = new Set(["color", "background-color", "border-color", "box-shadow", "transform"]);
    const offenders: string[] = [];
    for (const file of walk(SRC, (f) => f.endsWith(".css"))) {
      const rel = path.relative(REPO, file);
      postcss.parse(readFileSync(file, "utf8")).walkDecls((d: Declaration) => {
        const prop = d.prop;
        const value = d.value.trim();
        if (/^animation(-duration)?$/.test(prop) && value !== "none") {
          offenders.push(`${rel}: ${prop}: ${value}`);
        }
        if (!/^transition(-duration|-property)?$/.test(prop)) return;
        if (value === "none" || value.startsWith("none ")) return;
        if (prop === "transition-duration") {
          if (value !== "var(--motion-fast)") offenders.push(`${rel}: ${prop}: ${value}`);
          return;
        }
        if (prop === "transition-property") {
          for (const p of value.split(",").map((v) => v.trim())) {
            if (!ALLOWED.has(p)) offenders.push(`${rel}: ${prop}: ${p}`);
          }
          return;
        }
        for (const layer of value.split(",").map((v) => v.trim())) {
          const [p, duration, ...rest] = layer.split(/\s+/);
          if (!ALLOWED.has(p ?? "") || duration !== "var(--motion-fast)" || rest.length > 0) {
            offenders.push(`${rel}: ${prop}: ${layer}`);
          }
        }
      });
    }
    // Inline styles and style strings in TS/TSX are the other place a
    // duration could hide.
    for (const file of walk(SRC, (f) => /\.tsx?$/.test(f))) {
      const source = readFileSync(file, "utf8");
      if (/transition\s*:\s*["'`][^"'`]*\d(ms|s)\b|transition:[^;"'`}]*\d(ms|s)\b/.test(source)) {
        offenders.push(path.relative(REPO, file));
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the reduced-motion rule removes every transition and animation", () => {
    const media = [] as AtRule[];
    postcss.parse(read(IDIOM)).walkAtRules("media", (at) => {
      if (/prefers-reduced-motion:\s*reduce/.test(at.params)) media.push(at);
    });
    expect(media).toHaveLength(1);
    const body = media[0]!.toString();
    expect(body).toMatch(/transition:\s*none\s*!important/);
    expect(body).toMatch(/animation:\s*none\s*!important/);
  });
});

describe("§0 14 — 1024 is the first medium width", () => {
  it("no max-width:1024px (or a max-lg: variant) remains in src/ui or src/app", () => {
    const offenders: string[] = [];
    for (const root of ["src/ui", "src/app"]) {
      for (const file of walk(path.join(REPO, root), (f) => /\.(css|tsx?)$/.test(f))) {
        const source = readFileSync(file, "utf8");
        if (/max-width:\s*1024px|max-width:\s*64rem|\bmax-lg:/.test(source)) {
          offenders.push(path.relative(REPO, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("§0 16 — 768 joins the sweep", () => {
  it("six widths, 320 · 768 · 1023 · 1024 · 1279 · 1280, and no 640", () => {
    expect([...widths()]).toEqual([320, 768, 1023, 1024, 1279, 1280]);
  });
});
