// Issue 1458 — the on-page check: ten things a search engine reads on one
// page, each fine or to fix, with one line saying what was found. The lines
// are copy keys; what fills them is the page's own text.
import { identityOf, typeWords } from "@/lib/business/identity";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { PageTags } from "./read";

/** Past these, Google commonly cuts a title or a description in a result. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** The three share tags a card needs. */
const SHARE_NEEDED = ["og:title", "og:description", "og:image"] as const;

export interface CheckResult {
  readonly name: CopyKey;
  readonly fine: boolean;
  readonly line: string;
}

function lengthCheck(name: CopyKey, value: string, max: number, keys: { fine: CopyKey; long: CopyKey; none: CopyKey }): CheckResult {
  if (value === "") return { name, fine: false, line: copy(keys.none) };
  const chars = [...value].length;
  if (chars > max) return { name, fine: false, line: copy(keys.long, { chars, value }) };
  return { name, fine: true, line: copy(keys.fine, { chars, value }) };
}

/** `en-US` → `English (United States)`; a tag no browser knows stays as written. */
function languageName(tag: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language", languageDisplay: "standard" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** Business details only where a label says who runs the site, named by its most specific type. */
function schemaCheck(types: readonly string[]): CheckResult {
  const identity = identityOf(types);
  if (identity !== null) return { name: "tools.check.schema", fine: true, line: copy("tools.check.schema.fine", { value: typeWords(identity.type) }) };
  return { name: "tools.check.schema", fine: false, line: copy(types.length === 0 ? "tools.check.schema.none" : "tools.check.schema.other") };
}

export function onPageChecks(t: PageTags): readonly CheckResult[] {
  const h1 = t.h1.filter((h) => h !== "");
  const missingShare = SHARE_NEEDED.filter((tag) => (t.share[tag] ?? "") === "");
  return [
    lengthCheck("tools.check.title", t.title, TITLE_MAX, {
      fine: "tools.check.title.fine",
      long: "tools.check.title.long",
      none: "tools.check.title.none",
    }),
    lengthCheck("tools.check.description", t.description, DESCRIPTION_MAX, {
      fine: "tools.check.description.fine",
      long: "tools.check.description.long",
      none: "tools.check.description.none",
    }),
    h1.length === 1
      ? { name: "tools.check.h1", fine: true, line: copy("tools.check.h1.fine", { value: h1[0] ?? "" }) }
      : h1.length === 0
        ? { name: "tools.check.h1", fine: false, line: copy("tools.check.h1.none") }
        : { name: "tools.check.h1", fine: false, line: copy("tools.check.h1.many", { count: h1.length }) },
    t.canonical === ""
      ? { name: "tools.check.canonical", fine: false, line: copy("tools.check.canonical.none") }
      : { name: "tools.check.canonical", fine: true, line: copy("tools.check.canonical.fine", { value: t.canonical }) },
    t.noindex
      ? { name: "tools.check.index", fine: false, line: copy("tools.check.index.none") }
      : { name: "tools.check.index", fine: true, line: copy("tools.check.index.fine") },
    schemaCheck(t.schemaTypes),
    missingShare.length === 0
      ? { name: "tools.check.share", fine: true, line: copy("tools.check.share.fine") }
      : { name: "tools.check.share", fine: false, line: copy("tools.check.share.none", { value: missingShare.join(", ") }) },
    t.phoneViewport
      ? { name: "tools.check.viewport", fine: true, line: copy("tools.check.viewport.fine") }
      : { name: "tools.check.viewport", fine: false, line: copy("tools.check.viewport.none") },
    t.images === 0
      ? { name: "tools.check.images", fine: true, line: copy("tools.check.images.empty") }
      : t.imagesWithoutAlt === 0
        ? { name: "tools.check.images", fine: true, line: copy("tools.check.images.fine") }
        : {
            name: "tools.check.images",
            fine: false,
            line: copy("tools.check.images.none", { count: t.imagesWithoutAlt, total: t.images }),
          },
    t.lang === ""
      ? { name: "tools.check.lang", fine: false, line: copy("tools.check.lang.none") }
      : { name: "tools.check.lang", fine: true, line: copy("tools.check.lang.fine", { value: languageName(t.lang) }) },
  ];
}

/** The three groups the on-page check lists its ten checks in, each by its checks' names. */
export const CHECK_GROUPS: readonly { readonly name: CopyKey; readonly checks: readonly CopyKey[] }[] = [
  { name: "tools.group.google", checks: ["tools.check.title", "tools.check.description", "tools.check.share"] },
  {
    name: "tools.group.reads",
    checks: ["tools.check.h1", "tools.check.canonical", "tools.check.index", "tools.check.schema", "tools.check.lang"],
  },
  { name: "tools.group.visitors", checks: ["tools.check.viewport", "tools.check.images"] },
];

/** The tags the meta preview lists, as their machine names. */
export const PREVIEW_TAGS = [
  "title",
  "description",
  "canonical",
  "og:title",
  "og:description",
  "og:image",
  "twitter:card",
] as const;
export type PreviewTag = (typeof PREVIEW_TAGS)[number];

/** A tag's value on the page, `""` where it is absent. */
export function tagValue(t: PageTags, tag: PreviewTag): string {
  if (tag === "title") return t.title;
  if (tag === "description") return t.description;
  if (tag === "canonical") return t.canonical;
  return t.share[tag] ?? "";
}

/** A tag as its HTML writes it. */
export function tagName(tag: PreviewTag): string {
  return tag === "description" ? "meta description" : tag;
}

/** What a tag does, and its short name in a list of what to fix. */
export function tagWords(tag: PreviewTag): { what: string; name: string } {
  const key = `tools.tag.${tag === "title" ? "page-title" : tag.replace(":", "-")}`;
  return { what: copy(key as CopyKey), name: copy(`${key}.name` as CopyKey) };
}
