// src/lib/market/prompts/names.ts — the name an AI answer is read for. A leaf, so the free scan imports no panel code.

/** The site's own name where it is a name, else the domain's first label. A title that is a sentence is not a name an answer would repeat. */
export function promptSiteName(siteName: string | null, domain: string): string {
  const name = (siteName ?? "").trim();
  if (name !== "" && name.length <= 40 && name.split(/\s+/).length <= 4) return name;
  const label = domain.toLowerCase().replace(/^www\./, "").split(".")[0] ?? domain;
  return label.length === 0 ? domain : label[0]!.toUpperCase() + label.slice(1);
}
