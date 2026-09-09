// tests/presentation/copy/allowlist.ts — ADR-010 point 1, WO-279 (supersedes WO-044)
//
// The declared allow-list of non-voice string positions ADR-010 point 1
// names — "attribute values, aria-*, test ids, class names" — as an
// explicit, reviewable data structure: one entry, one reason. Nothing else
// is allowed. `string-literal-sweep.test.ts` treats every JSX attribute as
// presumed voice by default (fail-closed) and consults this list as the
// one, narrow exemption — a new attribute a future component introduces is
// flagged until an entry is added here by name, never swallowed by a
// wildcard. That is a deliberate trade: a real non-voice attribute this
// list has not yet named costs one line here to clear (a maintenance
// point named explicitly in WO-279's return, not hidden).
export type AllowlistedAttribute =
  | { readonly kind: "exact"; readonly name: string; readonly reason: string }
  | { readonly kind: "prefix"; readonly prefix: string; readonly reason: string };

export const ATTRIBUTE_ALLOWLIST: readonly AllowlistedAttribute[] = Object.freeze([
  {
    kind: "prefix",
    prefix: "aria-",
    reason:
      "ADR-010 point 1 names 'aria-*' as its own category: these are almost " +
      "entirely state tokens (e.g. aria-selected, aria-invalid) rather than " +
      "composed sentences in this design system's registered components. " +
      "Known limitation, recorded rather than hidden: an aria-label carrying " +
      "a literal sentence would also pass this rule — no fixture in this " +
      "corpus does that today.",
  },
  {
    kind: "exact",
    name: "className",
    reason: "ADR-010 point 1's 'class names' category — a design-token class list, never a sentence.",
  },
  {
    kind: "exact",
    name: "pad",
    reason:
      "`IdiomCard`'s padding token ('lg') — the same category as `size` and " +
      "`variant`: it selects the card's inset, never what the card says.",
  },
  {
    kind: "exact",
    name: "testId",
    reason:
      "ADR-010 point 1's 'test ids' category again, reached through a prop " +
      "rather than through the attribute: `IdiomCard` and `Panel` take the " +
      "hook as `testId` and write it out as `data-testid`, so the string a " +
      "screen spells is the same kind of string in both spellings and is " +
      "never rendered to a reader. Named rather than matched by pattern, " +
      "which is this list's own rule.",
  },
  {
    kind: "exact",
    name: "data-testid",
    reason: "ADR-010 point 1's 'test ids' category — a test hook, never rendered to a reader.",
  },
  {
    kind: "exact",
    name: "testId",
    reason:
      "the same 'test ids' category, spelled as a component prop (issue " +
      "#374). A row helper that takes the hook and writes `data-testid` " +
      "itself is one place the attribute is spelled instead of five, and " +
      "the value is the same test hook either way — never rendered to a " +
      "reader.",
  },
  {
    kind: "exact",
    name: "data-theme",
    reason: "a theme token name (e.g. 'light'), read by CSS, not composed as a sentence.",
  },
  {
    kind: "exact",
    name: "data-tone",
    reason:
      "a tone token — `warn`, `accent` — read by a stylesheet exactly as " +
      "`data-theme` is, and the same category ADR-010 point 1 admits it " +
      "under. `Btn` and `ActionPanel` already carry it as an expression; " +
      "the sign-in screen's expired-link chip writes the one it always has " +
      "(issue #373), and a tone is never a sentence.",
  },
  {
    kind: "exact",
    name: "data-surface",
    reason: "BP-018's Surface writes this as a structural marker for tests/ui/layout to read; never rendered to a reader.",
  },
  {
    kind: "exact",
    name: "id",
    reason: "a DOM identifier pairing an element with a label or anchor, not a sentence.",
  },
  {
    kind: "exact",
    name: "htmlFor",
    reason: "a DOM identifier pairing a <label> with its control, not a sentence.",
  },
  {
    kind: "exact",
    name: "name",
    reason: "a form field's wire name, read by the server that receives the submission, not by a person.",
  },
  {
    kind: "exact",
    name: "type",
    reason: "an HTML attribute enum token (e.g. 'button', 'email', 'submit'), not a sentence.",
  },
  {
    kind: "exact",
    name: "href",
    reason: "a URL, not a sentence.",
  },
  {
    kind: "exact",
    name: "src",
    reason: "a URL, not a sentence.",
  },
  {
    kind: "exact",
    name: "rel",
    reason: "an HTML link-relation token (e.g. 'noopener'), not a sentence.",
  },
  {
    kind: "exact",
    name: "target",
    reason: "an HTML link-target token (e.g. '_blank'), not a sentence.",
  },
  {
    kind: "exact",
    name: "role",
    reason: "an ARIA role token (e.g. 'dialog'), not a sentence.",
  },
  {
    kind: "exact",
    name: "method",
    reason: "an HTML form method token ('get'/'post'), not a sentence.",
  },
  {
    kind: "exact",
    name: "action",
    reason: "a form submission URL, not a sentence.",
  },
  {
    kind: "exact",
    name: "state",
    reason:
      "a registered component's own discriminant token (e.g. Card's " +
      "'default' | 'degraded', BP-018 decision 2) — it chooses which arm of " +
      "the component renders, and is never read by a person.",
  },
  {
    kind: "exact",
    name: "variant",
    reason: "a registered component's style-variant token (e.g. 'primary'), not a sentence.",
  },
  {
    kind: "exact",
    name: "tone",
    reason:
      "a registered component's `Tone` token ('ok' | 'warn' | 'bad' | 'neutral' | " +
      "'accent'), the same category as `variant` and `state`: it selects a state " +
      "colour, and BP-018's words-not-colour rule means every component taking one " +
      "also requires the word beside it through a separate prop (Badge's required " +
      "text child).",
  },
  {
    kind: "exact",
    name: "size",
    reason:
      "a registered component's size token ('default' | 'sm'), the same category as " +
      "`variant`: it selects a scale, never a sentence.",
  },
  {
    kind: "exact",
    name: "state",
    reason:
      "a registered component's own discriminant (e.g. Card's 'default' | 'degraded'), " +
      "the same category as `variant`: it selects which arm of the component renders, " +
      "and every sentence either arm carries arrives through a separate prop.",
  },
  {
    kind: "exact",
    name: "direction",
    reason:
      "a registered component's layout-axis token (Steps' 'horizontal' | 'vertical'), the same " +
      "category as `variant`, `size` and `state`: it selects how the component lays itself out, " +
      "never what it says — every label it carries arrives through `steps[].label`.",
  },
  {
    kind: "exact",
    name: "tone",
    reason:
      "a registered component's `Tone` token ('ok' | 'warn' | 'bad' | 'neutral' | " +
      "'accent', src/ui/types.ts) — a state colour, never a sentence. On the same " +
      "footing as `variant` and `state` above: the component's own required text " +
      "child is what carries the meaning, which is exactly why `Badge` and `Alert` " +
      "make it required.",
  },
  {
    kind: "exact",
    name: "size",
    reason: "a registered component's size token ('default' | 'sm'), not a sentence.",
  },
  {
    kind: "exact",
    name: "lang",
    reason: "an HTML language tag (e.g. 'en'), not a sentence.",
  },
  {
    kind: "exact",
    name: "key",
    reason: "React's reconciliation key, never rendered to a reader.",
  },
  {
    kind: "exact",
    name: "size",
    reason:
      "a registered component's size token (Btn's 'default' | 'sm'), the same category " +
      "as `variant` and `state`: it selects how the component draws, never what it says.",
  },
  {
    kind: "exact",
    name: "tone",
    reason:
      "a registered component's `Tone` token ('accent' | 'ok' | 'warn' | 'bad' | 'neutral'). " +
      "The same category as `variant`, and safe for the same structural reason BP-018 gives " +
      "for the type: Badge **requires a text child** and Alert **requires `message`**, so a " +
      "tone can never stand in for a caption — every sentence either component carries " +
      "arrives through a separate prop that this sweep still governs.",
  },
  {
    kind: "exact",
    name: "terms",
    reason:
      "`PricingCard`'s own discriminant token ('report' | 'pricing', issue #369), the " +
      "same category as `state` and `variant`: it selects which of the two approved " +
      "wordings of the same four terms the card renders, and every sentence either arm " +
      "carries arrives from the registry through copy().",
  },
] as const);

export function isAllowlistedAttribute(attributeName: string): boolean {
  return ATTRIBUTE_ALLOWLIST.some((entry) =>
    entry.kind === "exact" ? entry.name === attributeName : attributeName.startsWith(entry.prefix)
  );
}
