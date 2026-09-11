/**
 * THE DIRECTION REGISTRY.
 *
 * A direction is NOT a token set. Every one of the five below is its own
 * component implementation rendering the same fixture: a different page
 * archetype, a different unit of content, a different technique for the
 * same rival comparison, a different channel carrying state, different
 * chrome, a different typographic strategy. That is the whole difference
 * between this subtree and /variants, which is left standing beside it.
 *
 * Everything in this file is REVIEWER-FACING ANNOTATION, drawn in --pv-*
 * chrome and never inside a product surface. It is not customer copy and
 * no direction renders a word of it on a screen a customer would see.
 */

export type DirectionId = "ledger" | "console" | "ranked" | "split" | "narrative";

export type Direction = {
  id: DirectionId;
  /** The reviewer's handle for it. Not a product name. */
  name: string;
  archetype: string;
  unit: string;
  comparison: string;
  stateChannel: string;
  chrome: string;
  typography: string;
  goodAt: string;
  badAt: string;
  /** Values the ruled token set does not provide. Honest count: this is
   *  what the direction costs to adopt. */
  newTokens: readonly { name: string; value: string; why: string }[];
  /** Components that are not in components.md §1–§3. Every one is
   *  `proposed` and needs the owner's word before any UI code names it. */
  newComponents: readonly string[];
  /** An approved artifact or ruling that would have to change. */
  wouldChange: readonly string[];
};

export const DIRECTIONS: readonly Direction[] = [
  {
    id: "ledger",
    name: "Ledger — the document",
    archetype:
      "A document read top to bottom in one measure. No dashboard, no modules beside each other: numbered sections separated by a hairline rule, with every figure hung in a margin column so the page can be read as prose or scanned as a column of numbers.",
    unit: "A ruled band — a rule, a section numeral in the margin, and content in the measure. No container, no card, no shadow, no radius.",
    comparison:
      "Numbers set in the text. The rival set is a definition list with dot leaders: name in ink, figure in mono at the right. There is no chart on this page at all — the ranking is carried by reading order and the magnitudes by the numerals themselves.",
    stateChannel:
      "Ink and an explicit label. Nothing is filled; a state is a word plus a weight, and a degraded section is an inset note with a leading rule.",
    chrome:
      "None. A running head carrying the domain and the date, and a table of contents at the top. The workspace form adds the three destinations as plain links in the running head — no sidebar exists in this direction.",
    typography:
      "The narrowest scale of the five: h3, body, xs and nothing else. Mono is structural — it owns the entire margin column, and the margin column owns every number on the page.",
    goodAt:
      "The stranger who opens it once, reads it once, and forwards it. It prints. It survives any width because it has one column at every width. It is the only direction where the provenance line under a figure is as legible as the figure.",
    badAt:
      "The returning customer. There is no way to scan it for what changed — no positions to compare against memory, no chart to read in one glance. Every fact costs a line of reading. It also makes the primary action hard to place: a document has no natural home for a button.",
    newTokens: [
      {
        name: "--d-figure",
        value: "88px",
        why: "The margin column. It is the width at which two mono figures of the widest length in the fixture (`2,400/mo`) sit without wrapping at --t-sm. --w-cell-min (96) is a calendar cell and --s-7 (48) is too narrow; neither names this.",
      },
    ],
    newComponents: ["RuledBand", "FigureList (dot-leader definition list)", "RuledNote"],
    wouldChange: [
      "BUILD §4.1 module 2 — 'Two equal cards, side by side — never stacked in importance'. A single-measure document stacks them by construction. This direction cannot be adopted for the report without that clause moving.",
      "BUILD §4.4 — the sidebar. The workspace form has no sidebar at any width.",
    ],
  },
  {
    id: "console",
    name: "Console — the instrument panel",
    archetype:
      "A dense panel of regions. No cards: regions are delimited by hairlines and a label, packed at the tightest spacing the ladder allows, so as much of the state as possible is visible without scrolling. Reads as an instrument, not as a page.",
    unit: "A region — a labelled area with a hairline boundary and a right-aligned count. Inside it, rows at --s-1 rhythm with a fixed status column on the left.",
    comparison:
      "A dot plot on a shared axis. Every domain including the customer sits on ONE 0–12 axis with gridlines at 0/6/12, so the customer's distance from the field is a distance you can see rather than five bars to compare. The gap module uses the dumbbell form of the same plot: `was` as a hollow dot, `now` as a filled one, a thin rule between, all on one shared scale — the two numbers the badge used to carry become two positions.",
    stateChannel:
      "A positional column and a glyph. The leftmost column of every row is state and only state; nothing is filled and no row changes colour. A degraded region prints its written line in that column's place.",
    chrome:
      "A command bar. One mono field across the top with key hints beside it, the three destinations as small mono links, no sidebar and no page head.",
    typography:
      "Mono is structural: every label, every count, every nav item and every figure is JetBrains Mono. Jakarta appears once, on the screen head. The scale is flat — eyebrow, xs, sm — with exactly one number above body size per screen.",
    goodAt:
      "The returning customer who opens this every morning and wants to know what moved. Highest information density of the five and the only one where the whole workspace fits above the fold on a laptop. The shared-axis plot is the strongest reading of 'the rivals are there and you are not' anywhere in this set.",
    badAt:
      "A stranger. It assumes you already know what the words mean, and it looks like a tool for someone who was trained on it — which is exactly wrong for a public page whose job is to land an argument in under a minute. Mono at body size is also the slowest of the five to read in quantity.",
    newTokens: [],
    newComponents: [
      "Region (hairline-delimited labelled area)",
      "DotPlot (shared-axis, direct-labelled)",
      "Dumbbell (the was/now arm of the same plot)",
      "CommandBar",
    ],
    wouldChange: [
      "BUILD §2.4 — the chart inventory is closed at five forms and 'a new chart form is a design-artifact approval first'. The dot plot and the dumbbell are a sixth and a seventh.",
      "BUILD §2.3 — 'Body 15px/1.55' in Jakarta. Mono at body size across a whole screen is a different reading of the type rule, not a token change.",
    ],
  },
  {
    id: "ranked",
    name: "Ranked — the board",
    archetype:
      "The page IS a ranking. Both screens lead with one table of every domain in the market, the customer included as a row in it, sorted by the measure that screen is about. Everything else on the page is subordinate to that table.",
    unit: "A table row. The row is the whole unit of content — identity, magnitude, state and action all live in columns of one row.",
    comparison:
      "A ranked table with inline magnitudes: the bar is drawn INSIDE the cell, behind its own number, so the ordering and the magnitude are the same object. The gap module is a slope chart — first measured week on the left, latest on the right, one line per rival on a shared scale, both ends direct-labelled. `276×` and `78×` stop being a number and a badge and become two positions and the line between them.",
    stateChannel:
      "Position and weight. The customer's row is identified by rank position, a leading rule and 700 weight — not by fill. Band is its own column with a word in it.",
    chrome: "A top bar with the three destinations as registered Tabs, and a breadcrumb line under it. No sidebar.",
    typography:
      "Row-driven and tight. Figures are mono at --t-h3 inside cells so a column of numbers is scannable; heads stay at --t-h4, well below the other directions, because on a board the head is not the point.",
    goodAt:
      "Making the competitive argument land in one object. A stranger sees themselves at the bottom of a list without a sentence being written, and a returning customer sees the same list and looks only at whether they moved. It is the only direction of the five that is equally good on both screens.",
    badAt:
      "Anything that is not a comparison. §4.1's problem cards, the DIY method and the pricing card have no rows and sit awkwardly under the board. A table is also the shape most likely to need horizontal room, and the narrow end costs a real design (here: the row becomes a stacked block, which is a table that has stopped being a table).",
    newTokens: [],
    newComponents: ["Board (table with a you-row)", "MagnitudeCell", "SlopeChart"],
    wouldChange: [
      "BUILD §2.4 — the closed chart inventory again: the slope chart is a sixth form.",
      "BUILD §4.1 module 2 — presence bars become a column of a larger table, so the module stops being a module.",
    ],
  },
  {
    id: "split",
    name: "Split — master and detail",
    archetype:
      "Two panes. A persistent list on the left of the things the screen is about; the detail for the selected one on the right. The page has no scroll narrative — you pick and the right pane changes. This is the only direction where the screen is a workspace rather than a rendering.",
    unit: "A list item on the left, a full-height detail section on the right. The item is a leading rule, a name and one figure; the detail is everything.",
    comparison:
      "A bullet chart, one per rival, in the detail pane: a track with the qualitative range behind it, a measure bar for now, and a tick for the comparative value. It is the only technique here that shows now, then and the field in one object at one rival's own scale — which is what a detail pane is for.",
    stateChannel:
      "A leading rule on the list item, in tone, plus the state word beside it. The list itself never fills; only the rule carries tone, so a list of twenty items has twenty hairlines rather than twenty coloured blocks.",
    chrome:
      "The master pane IS the chrome. The three destinations sit as a compact rail above the list; there is no separate sidebar and no top bar.",
    typography:
      "Interface-forward. Jakarta throughout at a compact scale; mono is reserved for figures and addresses only — the most conservative use of mono in the set.",
    goodAt:
      "Depth. It is the only direction that can hold the twelve questions, five absent searches and three problems without the page becoming long, because the left pane holds the index and the right pane holds one thing at a time. It is also the natural shape for §4.6's calendar and day panel, which the product already has.",
    badAt:
      "Being read once. A stranger on a phone gets a list and must tap to see anything — the argument is behind an interaction, and an argument behind an interaction does not get made. It also cannot be printed or forwarded as a single image, which is most of what a shareable public report is for.",
    newTokens: [
      {
        name: "--d-master",
        value: "288px",
        why: "The master pane. --w-sidebar (222) is the nav sidebar and --w-day-panel (290, itself proposed) is the day panel beside a calendar grid; a master list carrying a name, a state word and a figure on one line is neither of those surfaces, and borrowing one of their names for it would be a second home for a value that means something else.",
      },
    ],
    newComponents: ["SplitPane", "MasterItem", "BulletChart", "Rail"],
    wouldChange: [
      "BUILD §2.4 — the bullet chart is a sixth form.",
      "BUILD §4.4 — the sidebar is replaced by the master pane's rail.",
      "REQ/JN: a public report whose content is behind a selection is a different promise about what a shared link shows. That is an owner question, not a design one.",
    ],
  },
  {
    id: "narrative",
    name: "Narrative — the scrolling argument",
    archetype:
      "One full-bleed section per idea, each about a screenful, each with its own edge-to-edge background, scrolled through in order. There is no page furniture at all: the only persistent element is a sticky bar carrying the single primary action.",
    unit: "A full-bleed section. No container, no card, no boundary except the change of background from one section to the next.",
    comparison:
      "A horizontal bar set at full width — one bar per rival, the name set large above its own bar, the figure inside it. The customer's zero is a full-width empty track with the zero set in it, which is the loudest possible reading of §2.5's 'red appears only for the customer's problem being shown to them'.",
    stateChannel:
      "The section's own background. Tone is spent at full-bleed scale rather than as a chip — a section IS the state it reports, and it carries an explicit word as well because a background alone may never carry meaning.",
    chrome:
      "None while scrolling, plus a sticky action bar at the bottom holding the one primary action. The workspace form adds a sticky mini-bar at the top with the domain and the week.",
    typography:
      "The widest scale of the five, and the only one that needs a step above --t-num-big. Body is set at --t-h4 rather than --t-body-size. Mono is reserved for the hero numerals, where it is doing the most work it does anywhere in this set.",
    goodAt:
      "The stranger, on a phone, who was sent a link. It is the only direction that is fully designed for the narrow end rather than reduced to it, and the only one where the argument is unmissable — a full-bleed zero is not something you scroll past.",
    badAt:
      "Density, and therefore the returning customer entirely. Five modules take five screenfuls; nothing can be compared against anything not currently on screen. It is also the direction that most wants copy — and copy is what a preview may not write, so what you are looking at is the SHAPE of an argument with the argument missing.",
    newTokens: [
      {
        name: "--d-display",
        value: "64px",
        why: "The hero numeral. --t-num-big (44) is the biggest step the ruled scale has and it is the dashboard tile's size; a full-bleed section that leads with one number needs a step above it, which is a genuinely new value and not a re-application of an existing one.",
      },
      {
        name: "--d-band",
        value: "68svh",
        why: "The minimum height of a full-bleed section. It is a min-height, never a height, so a section that needs more room takes it and nothing clips. No ruled token expresses a viewport fraction at all.",
      },
    ],
    newComponents: ["BleedSection", "Hero (display numeral + label)", "BigBar", "StickyActionBar"],
    wouldChange: [
      "BUILD §2.3's heading scale — a display step above --t-num-big is a new rung, and the scale was ruled by the owner on 2026-09-02.",
      "BUILD §2.5 — 'max one headline number per module' survives, but 'explanatory text is one short written line, 11–12px, dim' does not: at this scale the explanatory line is the section.",
      "BUILD §4.1 — six modules in order becomes roughly a dozen sections. The order survives; the count does not.",
    ],
  },
];

export function getDirection(id: string): Direction | undefined {
  return DIRECTIONS.find((d) => d.id === id);
}

export const SCREENS = ["report", "overview"] as const;
export type ScreenId = (typeof SCREENS)[number];

export const SCREEN_META: Record<ScreenId, { title: string; spec: string; who: string }> = {
  report: {
    title: "The public report",
    spec: "/scan/{domain} · BUILD §4.1's six modules",
    who: "A stranger, read once, on an unknown display.",
  },
  overview: {
    title: "The workspace overview",
    spec: "/app · BUILD §4.5's five modules",
    who: "The returning customer, opened every day.",
  },
};
