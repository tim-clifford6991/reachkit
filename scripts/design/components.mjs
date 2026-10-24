// Design parity: the lucide icons a canvas board draws, read through a checked-in map
// because the canvas draws older lucide shapes than the installed package.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import { BOARD_ONLY, PARITY_DIR } from "./parity.mjs";

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

/**
 * Every 24-box icon a board draws outside its annotations, with the lucide name the map gives it.
 * @returns {{ hash: string, shape: string, name: string | undefined }[]}
 */
export function boardIcons(html, icons = readIcons()) {
  return parse(html)
    .querySelectorAll('svg[viewBox="0 0 24 24"]')
    .filter((svg) => {
      for (let n = svg.parentNode; n; n = n.parentNode) if (OUTSIDE.some((c) => n.classList?.contains(c))) return false;
      return true;
    })
    .map((svg) => {
      const shape = iconShape(svg);
      const hash = shapeHash(shape);
      return { hash, shape, name: icons[hash] };
    });
}
