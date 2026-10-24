// Which lucide icons a rendered part draws, read from the markup: lucide names
// each icon in the class right after `lucide`.
import { expect } from "vitest";

/** Each `svg`'s lucide name, in markup order. */
export const icons = (markup: string): string[] =>
  [...markup.matchAll(/class="lucide lucide-([a-z0-9-]+)/g)].map((m) => m[1] ?? "");

/** The tiles of the "What €49 buys" list labelled `label`. */
export function buysIcons(markup: string, label: string): string[] {
  const at = markup.indexOf(`aria-label="${label}"`);
  expect(at, label).toBeGreaterThan(-1);
  return icons(markup.slice(at, markup.indexOf("</ul>", at)));
}

/** The "What to expect" card's step icons, then its notes' icons. */
export function whenIcons(markup: string): { steps: string[]; notes: string[] } {
  const at = markup.indexOf('<ul class="timeline');
  expect(at).toBeGreaterThan(-1);
  const end = markup.indexOf("</ul>", at);
  return { steps: icons(markup.slice(at, end)), notes: icons(markup.slice(end, markup.indexOf("</div>", end))) };
}
