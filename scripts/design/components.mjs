// Design parity: the components a canvas board draws (lucide icons, rings, bars, charts, cards)
// and how many of each the shipped page carries. Board icons are read through a checked-in map
// because the canvas draws older lucide shapes than the installed package.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import { BOARD_ONLY, COMPONENT, PARITY_DIR } from "./parity.mjs";

export const ICONS_FILE = path.join(PARITY_DIR, "icons.json");
// The board's annotations, and the status bar of a phone frame, which is chrome.
const OUTSIDE = [...BOARD_ONLY, "bbar"];
const GEOMETRY = ["d", "points", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2"];

/** @returns {Record<string, string>} shape hash → lucide file name */
export function readIcons(file = ICONS_FILE) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** An icon's children as tags and geometry only, so colour, size and class never change its shape. */
export function iconShape(svg) {
  return svg.childNodes
    .filter((c) => c.nodeType === 1)
    .map((c) => `${c.rawTagName.toLowerCase()}(${GEOMETRY.filter((k) => c.getAttribute(k) != null).map((k) => `${k}=${c.getAttribute(k).replace(/\s+/g, " ").trim()}`).join(";")})`)
    .join("");
}

export const shapeHash = (shape) => createHash("sha1").update(shape).digest("hex").slice(0, 8);

// A site's own logo slot draws a placeholder mark, never a lucide icon.
const annotated = (el) => {
  for (let n = el.parentNode; n; n = n.parentNode) {
    if (OUTSIDE.some((c) => n.classList?.contains(c)) || n.getAttribute?.("data-slot") === "site-logo") return true;
  }
  return false;
};

/**
 * Every 24-box icon a board draws outside its annotations, with the lucide name the map gives it.
 * @returns {{ hash: string, shape: string, name: string | undefined }[]}
 */
export function boardIcons(html, icons = readIcons()) {
  return (typeof html === "string" ? parse(html) : html)
    .querySelectorAll('svg[viewBox="0 0 24 24"]')
    .filter((svg) => !annotated(svg))
    .map((svg) => {
      const shape = iconShape(svg);
      const hash = shapeHash(shape);
      return { hash, shape, name: icons[hash] };
    });
}

function counter() {
  /** @type {Map<string, number>} */
  const counts = new Map();
  return { counts, add: (token) => counts.set(token, (counts.get(token) ?? 0) + 1) };
}

/** What a board draws, as `icon:<name>`, `ring`, `progress`, `chart` and `card` counts. */
export function boardComponents(html, icons = readIcons()) {
  const root = parse(html);
  const { counts, add } = counter();
  for (const icon of boardIcons(root, icons)) if (icon.name) add(`icon:${icon.name}`);
  for (const svg of root.querySelectorAll("svg")) {
    if (svg.getAttribute("viewBox") === "0 0 24 24" || annotated(svg)) continue;
    if (svg.querySelector("polyline, polygon, line")) add("chart");
    // The brand mark is the one drawing with <defs>, and it is no ring.
    else if (!svg.querySelector("defs") && (svg.querySelector('circle[fill="none"]') || svg.querySelectorAll("path").some((p) => /a/i.test(p.getAttribute("d") ?? "")))) add("ring");
  }
  // `.mbar` and `.bbar` are the frame's chrome; only `.track` is a bar the screen draws.
  for (const el of root.querySelectorAll(".track")) if (!annotated(el)) add("progress");
  for (const el of root.querySelectorAll(".card, .daycell, .tcard")) if (!annotated(el)) add("card");
  return counts;
}

// daisyUI draws the collapse arrow in CSS, so it stands for the board's chevron (DESIGN 2026-10-07).
const SHIP_CLASSES = { "icon:chevron-down": ".collapse-arrow", ring: ".radial-progress", progress: "progress, .progress", chart: ".recharts-wrapper", card: ".card" };

/** What a shipped page draws, in the board's tokens. */
export function shipComponents(htmls, icons = readIcons()) {
  const { counts, add } = counter();
  for (const html of htmls) {
    const root = parse(html);
    for (const svg of root.querySelectorAll("svg")) {
      // lucide-react's last `lucide-` class is the icon's file name.
      const lucide = (svg.getAttribute("class") ?? "").split(/\s+/).filter((c) => c.startsWith("lucide-")).pop();
      const name = lucide ? lucide.slice("lucide-".length) : svg.getAttribute("viewBox") === "0 0 24 24" ? icons[shapeHash(iconShape(svg))] : undefined;
      if (name) add(`icon:${name}`);
    }
    for (const [token, selector] of Object.entries(SHIP_CLASSES)) root.querySelectorAll(selector).forEach(() => add(token));
  }
  return counts;
}

/** `component:<token> <n>`: an allow line that excuses up to n of a token's gap. */
export const COMPONENT_LINE = /^component:(\S+) (\d+)$/;

/**
 * One board's components against its shipped pages, shaped like `compare()`: one `missing` entry per
 * component the pages lack, extra components ignored, and every allow line that excuses more than the gap.
 * @param {string} boardHtml
 * @param {string[]} shipHtmls
 * @param {{ string: string, n?: number }[]} [allow]
 * @returns {{ matched: string[], allowed: string[], missing: string[], unused: { string: string, n?: number, ships: boolean, why?: string }[] }}
 */
export function compareComponents(boardHtml, shipHtmls, allow = [], icons = readIcons()) {
  const drawn = boardComponents(boardHtml, icons);
  const shipped = shipComponents(shipHtmls, icons);
  const excused = new Map();
  /** @type {{ matched: string[], allowed: string[], missing: string[], unused: { string: string, n?: number, ships: boolean, why?: string }[] }} */
  const result = { matched: [], allowed: [], missing: [], unused: [] };
  for (const a of allow.filter((line) => line.string.startsWith(COMPONENT))) {
    const [, token = a.string, n = "0"] = COMPONENT_LINE.exec(a.string) ?? [];
    const board = drawn.get(token) ?? 0;
    const gap = Math.max(0, board - (shipped.get(token) ?? 0));
    excused.set(token, Math.min(Number(n), gap));
    if (gap === 0) result.unused.push({ string: a.string, n: a.n, ships: board > 0, why: `delete it: ${board > 0 ? "the component ships" : "the board does not draw it"}` });
    else if (Number(n) > gap) result.unused.push({ string: a.string, n: a.n, ships: false, why: `lower it to ${gap}` });
  }
  for (const [token, board] of [...drawn].sort(([a], [b]) => a.localeCompare(b))) {
    const gap = Math.max(0, board - (shipped.get(token) ?? 0));
    const allowed = excused.get(token) ?? 0;
    if (gap === 0) result.matched.push(token);
    for (let i = 0; i < allowed; i++) result.allowed.push(token);
    for (let i = allowed; i < gap; i++) result.missing.push(token);
  }
  return result;
}
