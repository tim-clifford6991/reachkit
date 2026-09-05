// src/lib/presentation/copy/registry.ts — BP-020, WO-041
//
// The closed partition list, written once (BP-020 decision 5). Every
// sentence the product speaks in its own voice is composed here from the
// thirteen `keys/*.ts` partitions — no fourteenth import, no re-export by
// name. (Twelve until issue #19 added `keys/signin.ts` for the sign-in
// screen's sentences, on the footing `keys/offer.ts`'s own header records
// for the twelfth: BP-020 decision 5 named eleven partitions before the
// BP-001-owned surfaces existed, and a surface's sentences must land in
// some partition. `registry.test.ts` pins the list; growing it is a
// two-line change here and a named row there, never a silent spread.) `COPY` and `COPY_META` are frozen object literals in the bundle,
// never a fetch, a template store or an i18n catalogue (REQ-093 criterion
// 5): with every language model unavailable, every value here still reads
// the same, because nothing here ever reached for one.
//
// `CopyMeta` and `CopyPartition` are declared here — the one place the file
// plan assigns them — and every `keys/*.ts` partition imports them back with
// `import type`, never a value import. A type-only import is erased before
// the bundle exists, so the apparent cycle (this file value-imports the
// partitions; the partitions type-import this file) is not a runtime cycle
// at all: nothing survives to `require`/`import` at either end.
import { REPORT_COPY } from "./keys/report.ts";
import { OVERVIEW_COPY } from "./keys/overview.ts";
import { CALENDAR_COPY } from "./keys/calendar.ts";
import { DRAFT_COPY } from "./keys/draft.ts";
import { SETTINGS_COPY } from "./keys/settings.ts";
import { SETUP_COPY } from "./keys/setup.ts";
import { PUBLISH_COPY } from "./keys/publish.ts";
import { DANGER_COPY } from "./keys/danger.ts";
import { MAIL_COPY } from "./keys/mail.ts";
import { OFFER_COPY } from "./keys/offer.ts";
import { BANDS_COPY } from "./keys/bands.ts";
import { LAWS_COPY } from "./keys/laws.ts";
import { SIGNIN_COPY } from "./keys/signin.ts";

export interface CopyMeta {
  /** Which cross-cutting law, if any, governs this sentence. The conformance
   *  suites enumerate their own scope from this tag rather than from a list a
   *  developer maintains. */
  law?: "next-publish" | "stopped-work" | "no-presence-yet" | "unmeasured";
  /** Named text slots and what each accepts. A slot of kind 'measured' may be
   *  filled only through `explain()`; `copy()` refuses such a key. */
  slots: Readonly<Record<string, "text" | "date" | "measured">>;
  /** The requirement clause that fixes what this sentence must say. */
  fixedBy: string; // e.g. "REQ-092 c4"
}

export type CopyPartition = Readonly<Record<string, readonly [string, CopyMeta]>>;

// Step 2: spread every partition, in a fixed order, into one object literal.
// `satisfies`, not a type annotation — an annotation would widen each
// entry's `slots` to `Record<string, 'text'|'date'|'measured'>` and destroy
// the per-key slot literals WO-042's `ExplainKey` is computed from, while
// `satisfies` keeps the literal types and still keeps this object checked
// against the shape every partition must have.
//
// A key declared in two partitions is not a duplicate-identifier error at
// this spread — TypeScript does not diagnose overlapping keys contributed
// by two different spread expressions, it silently lets the later one win.
// `registry.test.ts` — "the partition list is closed and total" — is what
// actually catches a collision, by checking the thirteen source partitions
// pairwise for a shared key before this spread ever runs.
const ENTRIES = {
  ...REPORT_COPY,
  ...OVERVIEW_COPY,
  ...CALENDAR_COPY,
  ...DRAFT_COPY,
  ...SETTINGS_COPY,
  ...SETUP_COPY,
  ...PUBLISH_COPY,
  ...DANGER_COPY,
  ...MAIL_COPY,
  ...OFFER_COPY,
  ...BANDS_COPY,
  ...LAWS_COPY,
  ...SIGNIN_COPY,
} as const satisfies Record<string, readonly [string, CopyMeta]>;

type Entries = typeof ENTRIES;

/** Every sentence the product speaks in its own voice, composed from the
 *  closed partition list. A frozen object literal in the bundle. */
export const COPY: Readonly<{ [K in keyof Entries]: Entries[K][0] }> = Object.freeze(
  Object.fromEntries(Object.entries(ENTRIES).map(([key, entry]) => [key, entry[0]]))
) as { [K in keyof Entries]: Entries[K][0] };

export type CopyKey = keyof typeof COPY;

/** The parallel, exhaustive metadata map, projected from the same
 *  partitions. `Record<CopyKey, CopyMeta>` is total, so a key added without
 *  meta is a compile error. */
export const COPY_META: Readonly<{ [K in keyof Entries]: Entries[K][1] }> = Object.freeze(
  Object.fromEntries(Object.entries(ENTRIES).map(([key, entry]) => [key, entry[1]]))
) as { [K in keyof Entries]: Entries[K][1] };

// Step 6/Decision (rule 1.1): the empty-value-plus-throw representation.
// A key whose string the owner has not yet supplied lands here with `''`
// and its key listed below; `copy()` refuses to render it. Derived, not
// hand-maintained twice: a key is owner-owed exactly when its value is the
// empty string, so this list and `COPY`'s empty values cannot drift apart.
export const OWNER_OWED: readonly CopyKey[] = Object.freeze(
  (Object.keys(ENTRIES) as CopyKey[]).filter((key) => COPY[key] === "")
);

/** 2026-09-05, issue #13. `CLAUDE.md`'s standing rule for this repo is
 *  "add the key, leave the value `TODO(copy)`, flag it in the PR" — a
 *  second, *renderable* way of saying a sentence is still the owner's,
 *  and the one a whole screen full of new keys has to use: the empty
 *  value's `copy()` throw takes the screen down with it, which hides the
 *  eleven modules that were finished from the review the owner needs to
 *  do to write the twelfth's sentence.
 *
 *  Renderable is not invisible. This list is derived the same way
 *  `OWNER_OWED` is — a key is awaiting copy exactly when its value is the
 *  marker — so "what is still unwritten" stays one question with one
 *  answer, and `tests/presentation/copy/registry.test.ts` counts both
 *  lists rather than only the one that throws. */
export const TODO_COPY_MARKER = "TODO(copy)";

export const AWAITING_COPY: readonly CopyKey[] = Object.freeze(
  (Object.keys(ENTRIES) as CopyKey[]).filter((key) => COPY[key] === TODO_COPY_MARKER)
);
