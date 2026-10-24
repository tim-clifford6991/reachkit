// Which lucide icons a rendered part draws, read from the markup: lucide names
// each icon in the class right after `lucide`.
import { expect } from "vitest";
import type { HTMLElement } from "node-html-parser";

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

/** The week card under `#id`: its legend's icons, each Planned badge's icons, and each page day's parts in order. */
export function weekCard(root: HTMLElement, id: string, planned: string): { legend: string[]; planned: string[][]; days: string[][] } {
  const ol = root.querySelector(`#${id} ol`);
  expect(ol, id).not.toBeNull();
  const lis = ol!.children;
  return {
    legend: icons(ol!.nextElementSibling?.outerHTML ?? ""),
    planned: lis.flatMap((li) => li.querySelectorAll(".badge").filter((b) => b.text.trim() === planned).map((b) => icons(b.outerHTML))),
    days: lis
      .filter((li) => li.querySelector("svg.lucide-file-text"))
      .map((li) => li.children.slice(0, 4).map((part) => (part.querySelector("svg.lucide-file-text") ? "sketch" : part.text.trim()))),
  };
}
