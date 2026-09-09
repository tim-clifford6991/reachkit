// BUILD §2.1 · §2.3 · §12 — the mail frame names tokens; it never mints values.
//
// A mail client cannot resolve `var(--accent)`, so the seam has to carry
// resolved values inline. `src/lib/mail/shell/tokens.ts` is the one place
// they are written down, and this suite holds both halves of that claim:
// every value there is the one `src/ui/theme.css` and `src/ui/type.css`
// declare, and no other file under `src/lib/mail/**` contains a colour or
// a font stack at all.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAIL_TOKENS, token } from "../../../src/lib/mail/shell/tokens";

const ROOT = path.resolve(__dirname, "../../..");
const MAIL_DIR = path.join(ROOT, "src/lib/mail");
const TOKENS_FILE = path.join(MAIL_DIR, "shell/tokens.ts");

/** Every bare `:root` block of `theme.css`, plus the `.rk-fonts` block of
 *  `type.css` — the places the design system binds the names this seam
 *  uses. **Every** `:root`, not the first: since #349 `theme.css` carries
 *  the approved token file exactly, and that file declares ruling 10a's six
 *  additions in a second block. A reader that stopped at the first `}` saw
 *  `--t-eyebrow` and not `--t-body`, which is how half a ladder reaches a
 *  mail unchecked. */
function declaredTokens(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [file, selector] of [
    ["src/ui/theme.css", ":root {"],
    ["src/ui/type.css", ".rk-fonts {"],
  ] as const) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    expect(source.indexOf(selector), `${file} has no ${selector} block`).toBeGreaterThan(-1);
    let from = 0;
    for (;;) {
      const start = source.indexOf(selector, from);
      if (start === -1) break;
      const end = source.indexOf("\n}", start);
      for (const match of source.slice(start, end).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
        const [, name, value] = match;
        if (name !== undefined && value !== undefined && !(name in out)) out[name] = value.trim();
      }
      from = end === -1 ? source.length : end + 2;
    }
  }
  return out;
}

/** Comments are prose about the rule, not the rule being broken — this
 *  suite reads what a mail actually emits, so `//` and block comments are
 *  removed before the source is scanned. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function mailSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".ts")) out.push(full);
    }
  };
  walk(MAIL_DIR);
  return out;
}

const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const COLOUR_FUNCTION = /\b(?:rgb|rgba|hsl|hsla|oklch|color-mix)\(/;
const FONT_STACK = /(?:JetBrains|Jakarta|ui-sans-serif|ui-monospace|SFMono|sans-serif|monospace)/;

/**
 * The two stacks that have no counterpart in `theme.css`, and why.
 *
 * A mail loads no webfont and an inbox understands almost none of the
 * generics the screens fall back through — `ui-sans-serif`, `system-ui` —
 * so several clients skip the declaration and render their default, which
 * is a serif: every numeral then loses ruling 7a. The mail therefore names
 * faces a reader is likely to have *installed*, which by construction are
 * not the product's two. Found on the owner's own render, 2026-09-09.
 *
 * Named here rather than waved through by widening the rule above: these
 * are the only two, they are asserted to be exactly the two, and both must
 * still end in a generic family so a client with none of the named faces
 * still gets the right kind of type.
 */
const MAIL_ONLY: readonly (keyof typeof MAIL_TOKENS)[] = ["--font-ui-mail", "--font-mono-mail"];

describe("BUILD §2.1 — every mail value is a BP-018 token", () => {
  it("every token this seam carries is the value theme.css / type.css declares", () => {
    const declared = declaredTokens();
    expect(Object.keys(MAIL_TOKENS).length).toBeGreaterThan(0);
    for (const name of Object.keys(MAIL_TOKENS) as (keyof typeof MAIL_TOKENS)[]) {
      if (MAIL_ONLY.includes(name)) continue;
      expect(declared[name], `${name} is not declared in theme.css or type.css`).toBeDefined();
      expect(token(name), `${name} drifted from its declaration`).toBe(declared[name]);
    }
  });

  it("the two mail-only stacks are exactly two, and each ends in a generic family", () => {
    const declared = declaredTokens();
    const orphans = (Object.keys(MAIL_TOKENS) as (keyof typeof MAIL_TOKENS)[]).filter(
      (name) => declared[name] === undefined
    );
    expect(orphans.sort()).toEqual([...MAIL_ONLY].sort());
    expect(token("--font-ui-mail").endsWith("sans-serif")).toBe(true);
    expect(token("--font-mono-mail").endsWith("monospace")).toBe(true);
    // And neither names a webfont: a face a mail cannot load is a face that
    // silently does nothing, which is what this pair exists to replace.
    for (const name of MAIL_ONLY) {
      expect(token(name), name).not.toContain("Plus Jakarta Sans");
      expect(token(name), name).not.toContain("JetBrains Mono");
    }
  });

  it("no file under src/lib/mail/** but tokens.ts contains a colour or a font stack", () => {
    const offenders: string[] = [];
    for (const file of mailSources()) {
      if (file === TOKENS_FILE) continue;
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const [rule, re] of [
        ["hex", HEX],
        ["colour-function", COLOUR_FUNCTION],
        ["font-stack", FONT_STACK],
      ] as const) {
        if (re.test(source)) offenders.push(`${path.relative(ROOT, file)} (${rule})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the sweep walks a non-empty tree — an empty walk would pass vacuously", () => {
    expect(mailSources().length).toBeGreaterThan(5);
  });
});
