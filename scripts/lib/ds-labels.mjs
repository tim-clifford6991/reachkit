/**
 * UI-label extraction for the design-system DRIFT check.
 *
 * WHY THIS EXISTS
 * ---------------
 * `mirror-lock.json` pins a hash of each mirrored LIVE file at reconcile time, so
 * `check:design`'s freshness only ever answers "did the live file move since we
 * blessed?". It is structurally blind to a mirror that was NEVER accurate — or
 * one blessed WHILE divergent (a `--bless` re-pins the hash; it does not verify
 * anything). That blindness let two real drifts read green: the AppShell card
 * still said "Progress" after the live nav was renamed "History", and
 * CompetitorsScreen rendered 2 of the live screen's 7 sections.
 *
 * This closes it by comparing CONTENT, not timestamps: the user-visible labels in
 * the live component must appear somewhere in the ds-src card(s) that mirror it.
 * A bless cannot silence this.
 *
 * Deliberately compares against `ds-src` (committed) rather than the prerendered
 * `ds-bundle` HTML (gitignored + build-only), so the gate runs in CI with no DS
 * build step.
 */

/** Strip JSX/HTML entities + collapse whitespace so both sides compare alike. */
export function normalize(s) {
  return s
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Values that look like UI text but aren't: css, code, paths, urls.
// Tuned against real output — an extractor that leaks code produces a noisy gate,
// and a noisy gate gets ignored, which is how we got here.
const NOISE = [
  /^[a-z]+([A-Z][a-z]*)+$/,        // camelCaseIdentifier
  /^[\d\s.,%+-]+$/,                // pure numbers/units
  /[{}$<>]/,                        // template/JSX residue
  /["'`]/,                          // quotes ⇒ a code expression, not copy
  /[()]/,                           // calls/ternaries: `0 ? "var(--c-band-high)" : delta`
  /\?|=>|&&|\|\||===|!==/,         // operators ⇒ code
  /^(https?:|\/|\.\/|@\/|#)/,      // urls / paths / hex
  /\b(px|rem|em|vw|vh|deg)\b/,     // css units
  /--c-|var\(/,                     // design tokens
  /^[A-Z_]+$/,                      // CONSTANT_CASE
];

function isUiText(s) {
  if (s.length < 3 || s.length > 60) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (!/^[A-Z0-9]/.test(s)) return false;      // UI copy starts capitalised
  if (NOISE.some((re) => re.test(s))) return false;
  if (!/\s/.test(s) && s.length < 4) return false; // single tiny word
  return true;
}

/**
 * Extract user-visible labels from a component / captured-HTML source.
 * Only reads clearly-UI positions (JSX text children + label/title/heading
 * props) — not every string literal — to keep the signal clean.
 */
export function extractLabels(src) {
  const out = new Set();
  const add = (raw) => {
    const s = normalize(raw);
    if (isUiText(s)) out.add(s);
  };

  // JSX / HTML text children: >Some Text<  (what the user actually reads)
  for (const m of src.matchAll(/>([^<>{}\n]{3,60})</g)) add(m[1]);
  // Nav/menu data: label: "X" / label="X" / heading: "X".
  // The (?<![-\w]) is load-bearing: a bare \b also matches the "label" inside
  // `aria-label="Site footer"`. Those are ATTRIBUTES, which `visibleText()`
  // strips from the rendered card — counting them would report permanent false
  // drift on copy that was never visible text to begin with.
  for (const m of src.matchAll(/(?<![-\w])(?:label|heading)\s*[:=]\s*"([^"]{3,60})"/g)) add(m[1]);

  return out;
}

/**
 * Visible text of a prerendered card (tags stripped).
 *
 * The comparison MUST be against rendered output, never the card's source: a
 * source match is satisfied by CODE. That exact false-negative hid the AppShell
 * drift — the card renders "Progress", but its source contains
 * `active={activeKey === "history"}`, so a source-level search for the live
 * label "History" "found" it and reported the card clean.
 */
export function visibleText(html) {
  return normalize(html.replace(/<[^>]+>/g, " ")).toLowerCase();
}

/** Live labels that the mirrored card(s) do not actually render. */
export function missingLabels(liveSrc, renderedUnionText) {
  const hay = renderedUnionText.toLowerCase();
  const missing = [];
  for (const label of extractLabels(liveSrc)) {
    if (!hay.includes(label.toLowerCase())) missing.push(label);
  }
  return missing.sort();
}
