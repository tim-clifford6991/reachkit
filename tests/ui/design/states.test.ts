// UI-SPEC §0 — the owner's sixteen rulings of 2026-09-11 (issue #530).
//
// Each `it` names the ruling it holds. The states are asserted on the
// stylesheets that carry them — the idiom's own classes in `idiom.css` and
// `shell.css` — because §0 says they live there and never per screen; a
// screen that restyled one would be a second definition this file does not
// see, which is the point. The calendar cell is daisyUI in the route since
// issue 732, so its state is read off the route.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Declaration } from "postcss";
import { describe, expect, it } from "vitest";
import { widths } from "../layout/widths";

const REPO = path.resolve(import.meta.dirname, "../../..");
const SRC = path.join(REPO, "src");
const read = (rel: string): string => readFileSync(path.join(REPO, rel), "utf8");

const IDIOM = "src/ui/idiom/idiom.css";
// The states that fall on a daisyUI component class are daisyUI's own since
// issue #548 — the owner ruling of 2026-09-11 retires the re-skins, and
// `docs/DESIGN.md` takes every state "from daisyUI's own state selectors with
// the theme's colours". What stays asserted here is what the product still
// declares: the calendar cell, the shell's nav row, and the one motion token.
const DAY_CARD = "src/app/(account)/app/calendar/DayCard.tsx";

function walk(dir: string, keep: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, keep, out);
    else if (keep(full)) out.push(full);
  }
  return out;
}

describe("§0 4–5 — the field's disabled and invalid states", () => {
  it("§0 4: S10's market card is not dimmed as a whole", () => {
    const form = read("src/app/(account)/setup/SetupForm.tsx");
    expect(form).not.toMatch(/\{\s*opacity:\s*0?\.6\s*\}/);
    expect(form).not.toMatch(/\bDIMMED\b/);
  });

});

describe("§0 10 — the calendar cell open in the panel", () => {
  // The cell is `DayCard.tsx` since issue 930: SPEC §7 (2026-09-20, #908)
  // makes it a fixed-height card with five rules of its own, and
  // `CalendarView` is now the screen's state around it.
  //
  it("the open day carries the 2px accent ring, and today is tinted (issue 1071)", () => {
    const cell = read(DAY_CARD);
    // `ring-inset` since issue 930: the card is 88px at its narrowest and
    // every pixel of it is spoken for, so the ring is drawn inside the
    // border box rather than outside it.
    expect(cell).toContain('p.selected ? "ring-2 ring-inset ring-primary"');
    expect(cell).toContain('"bg-primary/10"');
  });

  it('carries aria-current="date", and no longer aria-pressed', () => {
    const cell = read(DAY_CARD);
    expect(cell).toContain('aria-current={p.selected ? "date" : undefined}');
    expect(cell).not.toContain("aria-pressed={p.selected}");
  });
});

describe("SPEC §4 (2026-09-20) — the compact band keeps all three, as a dock", () => {
  // This supersedes UI-SPEC §0 11 (2026-09-11), which kept them as one
  // horizontal row inside a compact header: the owner-approved redesign
  // (#908) makes the side panel a drawer below `lg` and moves the three
  // menu items to a bottom bar. What is unchanged, and is what both
  // rulings are really about, is that none of the three is ever hidden and
  // no tab bar comes back.
  it("the compact band gets the dock, and the panel opens from the top bar", () => {
    const layout = read("src/app/(account)/app/layout.tsx");
    // The dock and the top bar are both still the shell's, and both still
    // drawn once. Since issue 912 the count reaches the dock as a promise
    // — the three links must be in the first server response and only the
    // badge waits — and the top bar is a slot behind its own boundary.
    // What this row is about is unchanged: the compact band gets a dock, a
    // top bar opens the panel, and no tab bar comes back.
    expect(layout).toContain("<AppDock waiting={waiting} />");
    expect(layout).toContain("<TopBarSlot shell={shell} />");
    expect(layout).not.toMatch(/TabBar/);
    expect(read("src/app/(account)/app/_shell/AppDock.tsx")).toContain("dock");
  });
});

describe("the calm layer — one easing, seven timings (owner, 2026-09-24, #1065)", () => {
  // Supersedes §0 13 (2026-09-11), whose one token was `--motion-fast: .18s`
  // on five properties. `docs/DESIGN.md`, *The calm layer*, "Motion": press
  // 120ms · hover colour 150ms · lift 200ms · tab underline and chevron
  // 250ms · screen enter 600ms · chart draw 1.4s · the pulse 2.4s, all on
  // `cubic-bezier(.2,.7,.2,1)`. 0s is the reduced-motion rule's own value.
  const TIMINGS = new Set(["120ms", "150ms", "200ms", "250ms", "600ms", "1.4s", "2.4s", "0s"]);
  const MOVES = /^(transition|animation)(-duration|-timing-function)?$|^--animate-|^--default-transition-/;
  // Any easing written out rather than read from the one token.
  const OTHER_EASING = /cubic-bezier\(|\b(ease|ease-in|ease-out|ease-in-out|linear)\b|steps\(/;

  it("every duration src's CSS states is one of the seven, and every easing is the one", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC, (f) => f.endsWith(".css"))) {
      const rel = path.relative(REPO, file);
      postcss.parse(readFileSync(file, "utf8")).walkDecls((d: Declaration) => {
        if (d.prop === "--ease-calm") {
          if (d.value.replace(/\s+/g, "") !== "cubic-bezier(.2,.7,.2,1)") offenders.push(`${rel}: ${d.prop}: ${d.value}`);
          return;
        }
        if (!MOVES.test(d.prop)) return;
        const value = d.value.trim();
        if (value === "none" || value.startsWith("none ")) return;
        for (const time of value.match(/(?<![\w-])\d*\.?\d+m?s\b/g) ?? []) {
          if (!TIMINGS.has(time)) offenders.push(`${rel}: ${d.prop}: ${time}`);
        }
        if (OTHER_EASING.test(value.replaceAll("var(--ease-calm)", ""))) offenders.push(`${rel}: ${d.prop}: ${value}`);
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
