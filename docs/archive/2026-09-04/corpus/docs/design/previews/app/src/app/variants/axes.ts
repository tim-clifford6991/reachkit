/**
 * THE AXES, THE POSITIONS, AND THE PRESETS.
 *
 * This file is the vocabulary only. It holds no design VALUE — every value
 * lives once, in variants.css, and this file names the positions that
 * select them (rule 2.4: one claim, one home). If you want to know what
 * `airy` is worth in pixels, variants.css is the single place that says.
 *
 * A preset is a TUPLE of positions, not a look. That is the whole point of
 * the exercise: the owner asked to compose rather than pick, so the unit
 * of choice is one position on one axis, and a preset is only a bookmark
 * for seven of them.
 */

export type AxisId =
  | "density"
  | "separation"
  | "radius"
  | "type"
  | "colour"
  | "chrome"
  | "figure";

export type SpecimenKind = "card" | "tiles" | "shell";

export type Position = {
  id: string;
  /** What this position does, in one line. */
  note: string;
  /** What it costs, stated rather than implied. */
  cost: string;
  /** A token this position spends that the registry does not hold. */
  proposes?: string;
  /** The design-guardian's own pick on this axis, with the argument. A menu
   *  with no opinion is worth less than a menu with one. */
  pick?: string;
};

export type Axis = {
  id: AxisId;
  attr: `data-${string}`;
  title: string;
  /** The one sentence that says what the axis is. */
  moves: string;
  /** The --v-* tokens this axis sets. Names only; values are in the CSS. */
  tokens: readonly string[];
  /** What the axis may NOT move, and which clause stops it. */
  fixed: string;
  specimen: SpecimenKind;
  positions: readonly Position[];
};

export const AXES: readonly Axis[] = [
  {
    id: "density",
    attr: "data-density",
    title: "Density",
    moves:
      "Which rungs of the ruled 4·8·12·16·24·32·48 ladder a surface picks for its inset and its gaps. No rung is redefined.",
    tokens: ["--v-card-pad", "--v-card-gap", "--v-module-gap", "--v-tile-gap", "--v-main-pad", "--v-tile-pad"],
    fixed:
      "The ladder itself. The owner ruled seven steps on 2026-09-02 and a variant applies them differently rather than replacing one.",
    specimen: "card",
    positions: [
      {
        id: "tight",
        note: "Every gap one rung down. A card's inset is --s-2 on a phone and --s-3 above --breakpoint-sm.",
        cost: "About one module more per screen, and the last rung above nothing on a phone: every owner string of unknown length wraps sooner, and the badge and button minimums (--s-5 / --s-7) stop shrinking with the padding, so a dense card looks proportionally control-heavy.",
      },
      {
        id: "base",
        note: "What the walkthroughs draw today.",
        cost: "None — it is the baseline you are comparing against.",
        pick:
          "Hold it. Airier reads modern on most products and costs the wrong thing on this one: the overview's primary action lives in module 5, behind four modules and two charts, and every rung of extra air pushes it further down the screen a customer opens most evenings. The density change I would make is not on this axis — it is taking the three stat tiles out of three separate cards, which is the data-presentation axis.",
      },
      {
        id: "airy",
        note: "Every gap one rung up. Modules sit --s-7 apart; a card's inset is --s-5 above --breakpoint-sm.",
        cost: "Roughly one module less above the fold on a laptop. The phone gains scroll rather than air — narrow card padding is floored at --s-4, which is `base`'s wide value, so a phone never spends --s-5 on its own edges. It tops out here: --s-7 is the last rung, and a genuinely airier page section wants a 64px step the ruled ladder does not hold.",
      },
    ],
  },
  {
    id: "separation",
    attr: "data-separation",
    title: "Separation",
    moves:
      "How one surface is told from another: a hairline border, an elevation shadow, a fill difference alone, or whitespace alone.",
    tokens: ["--v-card-bg", "--v-card-border-width", "--v-card-border-color", "--v-card-shadow", "--v-page-bg"],
    fixed:
      "--border-hair. There is one border width in the system and this axis chooses whether to spend it, never how thick it is.",
    specimen: "card",
    positions: [
      {
        id: "border",
        note: "Hairline border, --shadow-card, --surface on --bg. All four at once.",
        cost: "None. It is also the only position that reads identically in both themes, which is worth more than it looks.",
      },
      {
        id: "shadow",
        note: "No border. An elevation shadow carries the edge.",
        cost: "This is the position that behaves worst in dark. A shadow on #0e1116 is close to invisible, so dark silently falls back to reading a card by its fill alone — which is the `fill` position, unchosen. Toggle dark before you pick it. It also spends a token that does not exist yet.",
        proposes: "--shadow-lift",
      },
      {
        id: "fill",
        note: "No border, no shadow. --surface against --bg is the whole edge.",
        cost: "In light that is #ffffff on #f6f6f9 — real, and slight enough to vanish on a projector or an uncalibrated display. In dark it is #161a21 on #0e1116, which is stronger than the border position. The cheapest change on this list: it removes CSS rather than adding any.",
        pick:
          "Take it on the workspace, and only there. It is the single biggest modern-reading change available and it costs no token and no ruling. But it forces a second choice one axis down: with cards at --surface, a sidebar at --surface becomes one enormous card, so `fill` obliges chrome `hairline` or `bare`. And I would hold `border` on the public report — a stranger reads it once, on a display nobody calibrated, and §4.1's two equal cards stop reading as two equal things when the edge is 4% of a percentage point of luminance. That is the one place I would run two token sets rather than one.",
      },
      {
        id: "air",
        note: "The page becomes --surface and a card becomes whitespace. One hairline survives, under each module's eyebrow.",
        cost: "Reads best at --breakpoint-xl and worst on a phone, where two modules --s-7 apart are the only thing saying they are two modules. It also takes away the frame the `degraded` state was using: a card that loses its section keeps a border today and would keep nothing here, so the written line has to carry the whole state.",
      },
    ],
  },
  {
    id: "radius",
    attr: "data-radius",
    title: "Radius",
    moves:
      "Sharp, soft or pill, and whether it is uniform across element sizes or graduated by them.",
    tokens: ["--v-r-card", "--v-r-control", "--v-r-chip", "--v-r-cell"],
    fixed:
      "The three declared radii. --r-box 14, --r-field 9 and --r-pill are BUILD.md §2.1's, transcribed; three of the four positions only reassign them.",
    specimen: "card",
    positions: [
      {
        id: "soft",
        note: "Graduated as drawn today: --r-box on a card, --r-field on a control, --r-pill on a chip.",
        cost: "None.",
      },
      {
        id: "crisp",
        note: "`soft` with the card corner brought down to --r-field. The chip keeps its pill.",
        cost: "Almost nothing — 5px of corner on cards and tiles, and no new token. The 14px card corner is the most dated single value in the current drawing and this is the whole of the fix. Squaring the card and squaring the chip are different decisions and only this one is free: a badge carries a required text child, and the pill is what makes that child read as a badge rather than as a small button.",
        pick:
          "Ship it. It is the cheapest genuinely modern-reading change on the whole page: one token, no ruling, no proposal, and it survives every other axis. If you take one thing from this exploration, take this.",
      },
      {
        id: "flat",
        note: "Uniform --r-field everywhere, chips included.",
        cost: "A 9px control inside a 9px card reads flatter than it is, and a chip stops being distinguishable by shape from a small button. Spends no new token, which makes it `crisp` plus one more decision — and that decision costs the badge the shape that says what it is.",
      },
      {
        id: "edge",
        note: "A fourth radius under --r-field, uniform.",
        cost: "Spends a token that does not exist. BUILD.md §2.1 fixes three radii and calls them exact values — this is a fourth, not an edit of one of the three, so it needs your word before any UI code may name it. Refuse it and this position disappears; nothing else on this page depends on it.",
        proposes: "--r-edge",
        pick:
          "REFUSED, and I would refuse it even if asked for it. It buys 5px of corner over `crisp` and costs a ruling on a fourth value in a set BUILD.md calls exact. Look at it next to `crisp` on this page: the difference is small, and the difference in what it costs is not.",
      },
      {
        id: "round",
        note: "Graduated harder the other way: --r-pill on every control, --r-box on a cell.",
        cost: "A pill button and a pill badge stop being tellable apart by shape, and the badge is the one carrying a required text child. Reads friendly rather than sleek — worth seeing precisely because it is the opposite of the brief.",
      },
    ],
  },
  {
    id: "type",
    attr: "data-type",
    title: "Type contrast",
    moves:
      "Weight, tracking and which ink a secondary role takes. Never size.",
    tokens: ["--v-head-weight", "--v-subhead-weight", "--v-num-weight", "--v-eyebrow-ink", "--v-eyebrow-track"],
    fixed:
      "The 1.25 size scale (yours, ruled) and heading letter-spacing (BUILD.md §2.3's −0.02em, transcribed). §2.3 states heading weight as a RANGE, 700–800, so both ends are law and nothing under 700 is. Two inks are off this axis and bound once beside each other: §2.5's provenance line, always quiet, and the explanatory line under a card's answer, which tokens.md §4 binds to --ink-3 by name. A position that raised either would be a variant breaking law rather than applying it.",
    specimen: "card",
    positions: [
      {
        id: "base",
        note: "Heads at 800, eyebrow --ink-3 at .09em, the big number at mono 700.",
        cost: "None.",
      },
      {
        id: "poised",
        note: "`base` with one token moved: the big mono number at 500 instead of 700.",
        cost: "Almost nothing, and one thing worth arguing about. §2.5 says the card leads with the answer and the big mono number IS the answer, so lightening it is a real change in emphasis — but at 44px, mono 500 does not read weak, it reads composed, and 700 at that size is the other dated value in the current drawing. Judge it on the score tile with its delta badge beside it, which is where the weight difference actually shows.",
        pick:
          "Ship it. It is separated from `quiet` on purpose: heading weight and numeral weight are two decisions, and `quiet` takes both when only one of them is right.",
      },
      {
        id: "quiet",
        note: "Heads at 700, eyebrow tracking at .04em, the big number at mono 500.",
        cost: "Heads at 700 is where I would stop: a 25px module head and a 20px card head at the same weight separate by 5px alone, and the overview stacks five of them. The tracking change is fine and the numeral change is `poised`'s — this position is those two plus a weight I would not take.",
      },
      {
        id: "loud",
        note: "Heads and sub-heads at 800, eyebrow --ink-2 at .14em.",
        cost: "The eyebrow gets louder while the provenance line beside it must stay quiet, so two marks that look alike today stop looking alike — read that as a hierarchy or as an inconsistency, but read it deliberately. It also touches a design-file claim rather than a BUILD.md one: tokens.md §1 annotates --ink-3 as 'provenance and eyebrow text', and §2.5's verbatim rule covers provenance only. Taking this position means editing that annotation, which is a change to the law book and is flagged as one.",
      },
    ],
  },
  {
    id: "colour",
    attr: "data-colour",
    title: "Colour application",
    moves:
      "Whether a tone on chrome carries a tinted fill, or only its ink and its hairline.",
    tokens: ["--v-fill-neutral", "--v-fill-accent", "--v-fill-ok", "--v-fill-warn", "--v-fill-bad", "--v-nav-current-bg", "--v-nav-current-ink"],
    fixed:
      "Every chart. §2.4 closes the series palette at --chart-you and --chart-rival, so the dot-matrix cell, the presence bar and the sparkline endpoint keep their colour in both positions. And there is no third, more-colourful position: every further hue would have to mean something, and §2.4 and §2.5 have spent the meanings already.",
    specimen: "card",
    positions: [
      {
        id: "base",
        note: "Every tone carries its -bg fill: ok green, warn amber, bad red, accent violet.",
        cost: "None.",
        pick:
          "Hold it, and hold it hardest on the report. This is the axis I would refuse to move rather than merely decline to. §2.4 spends two colours on series and §2.5 spends the rest on meanings; the tone FILL is the only redundant channel state has left, and mono hands the whole job to ink. On a screen a stranger reads once, a green outline chip and a red outline chip are one hue apart, where a green fill and a red fill are not. If you want mono anywhere, want it on the workspace, where the reader already knows what the chips mean.",
      },
      {
        id: "mono",
        note: "Fills go to transparent. A tone keeps its ink and its -line hairline.",
        cost: "The meaning rules carry more weight because there is less colour doing the work — which is the trap and also the payoff. Two things to check by eye rather than take on trust: the empty queue is still a success state (it keeps --ok ink, so it is green text on nothing, never red), and the customer's own not-cited matrix cell keeps its red RING because a ring is a border and this axis moves fills. The genuine cost: red becomes the only saturated thing left on the screen, so the one place §2.5 permits it gets much louder. That is arguably correct and it is a change in emphasis, not a change in rule.",
      },
    ],
  },
  {
    id: "chrome",
    attr: "data-chrome",
    title: "Chrome weight",
    moves: "How loudly the shell asserts itself against the content it holds.",
    tokens: ["--v-sidebar-bg", "--v-sidebar-border-width", "--v-sidebar-border-color"],
    fixed:
      "--w-sidebar 222px and BUILD.md §4.4's own rule that the sidebar hides and top tabs take over. This axis changes the sidebar's weight, never its width and never its behaviour.",
    specimen: "shell",
    positions: [
      {
        id: "filled",
        note: "--surface fill and a hairline right edge, as drawn today.",
        cost: "None.",
      },
      {
        id: "hairline",
        note: "No fill. The hairline is the whole shell.",
        cost: "The sidebar and the content now share one background, so the current destination's own mark is doing all the orientation work. Free — it removes a declaration.",
        pick:
          "Ship it, and note that it is not a free-standing preference: it is forced by `fill` one axis up. With cards at --surface and a sidebar at --surface, the sidebar becomes one enormous card. That pairing is only visible by drawing both at once, which is what this page is for.",
      },
      {
        id: "bare",
        note: "No fill, no edge. The current destination is marked by an --s-1 inset rule instead of a filled pill.",
        cost: "Below --breakpoint-lg there is no sidebar at all, so this position is invisible on a phone — it changes the desktop only. And with `air` separation as well, the shell and the page become one surface with nothing between them; that pair is the one combination on this page I would not ship.",
      },
    ],
  },
  {
    id: "figure",
    attr: "data-figure",
    title: "Data presentation",
    moves:
      "Where a figure sits: in its own card, on a shared rule, or bare on the page.",
    tokens: ["--v-tile-bg", "--v-tile-border-width", "--v-tile-border-color", "--v-tile-shadow", "--v-tile-pad"],
    fixed:
      "The number itself. --t-num-big is the owner's ruled 44px and the mono + tabular-nums rule is mechanical; this axis moves the frame around a figure and never the figure.",
    specimen: "tiles",
    positions: [
      {
        id: "card",
        note: "Each tile is its own card, taking whatever the separation axis says a card is.",
        cost: "None. It is also the only position that inherits separation, so picking it means the figures follow whatever you pick one axis up.",
      },
      {
        id: "rule",
        note: "One row, no cards, a hairline between tiles — across on a phone, down from --breakpoint-md.",
        cost: "The three figures stop being three objects and become one module, which is right for a comparison and wrong if you ever want to act on one of them alone. It also fixes the tiles' fate to each other: a degraded third tile now sits inside the same frame as two good ones — switch the overview to `first-week` and look at it before deciding.",
        pick:
          "Ship it, and this is the one recommendation on the page that is a fidelity argument rather than a taste one. §4.5 numbers the overview's modules and the three stat tiles are module 3 — ONE module — while the current drawing gives them three cards, which reads as three modules and puts the module count at seven where the spec says five. `rule` makes them what §4.5 already says they are. Independently: with `fill` separation, three separate tile fills float with nothing holding them together, so this and `fill` want each other.",
      },
      {
        id: "bare",
        note: "No frame at all. Eyebrow, number, companion, on the page.",
        cost: "The most modern-looking and the least forgiving: with no frame, the only thing grouping a label to its number is proximity, so it depends entirely on the density axis. At `tight` it stops working. Pair it with `airy` or do not pick it.",
      },
    ],
  },
];

export const AXIS_IDS = AXES.map((a) => a.id);

/** Every axis at the value the walkthroughs draw today. */
export const BASE: Record<AxisId, string> = {
  density: "base",
  separation: "border",
  radius: "soft",
  type: "base",
  colour: "base",
  chrome: "filled",
  figure: "card",
};

export type Tuple = Record<AxisId, string>;

export type Preset = {
  id: string;
  /** One line on what it is trying to be. */
  intent: string;
  tuple: Tuple;
};

export const PRESETS: readonly Preset[] = [
  {
    id: "base",
    intent:
      "The current app, rendered through the same harness as the others so the comparison is honest. Change nothing and this is what you keep.",
    tuple: { ...BASE },
  },
  {
    id: "paper",
    intent:
      "One move, and the smallest one on this page: take the border and the shadow off a card and let the fill be the edge. Everything else is untouched.",
    tuple: { ...BASE, separation: "fill" },
  },
  {
    id: "edge",
    intent:
      "The sharp one. Square-ish corners, an elevation shadow instead of a border, and type turned up. It is also the only preset that spends both proposed tokens, so refusing them costs exactly this preset and nothing else.",
    tuple: { ...BASE, separation: "shadow", radius: "edge", type: "loud" },
  },
  {
    id: "dense",
    intent:
      "The console. Everything one rung tighter, one radius for everything, and the three figures on a shared rule instead of in three cards. This is the evening-workspace argument: more of the week visible without scrolling.",
    tuple: { ...BASE, density: "tight", radius: "flat", figure: "rule" },
  },
  {
    id: "open",
    intent:
      "The editorial one. Whitespace does all the separating, the shell nearly disappears, the figures sit bare on the page. It is the largest move here and the one most likely to read as expensive.",
    tuple: { ...BASE, density: "airy", separation: "air", chrome: "bare", figure: "bare" },
  },
  {
    id: "mono",
    intent:
      "The near-monochrome one. Tones keep their ink and lose their fill; heads come down to 700. Look hardest at the empty-queue state here — that is where a cleaner surface would break §2.5 if it were going to.",
    tuple: { ...BASE, colour: "mono", type: "quiet", separation: "fill", chrome: "hairline" },
  },
  {
    id: "guardian",
    intent:
      "What I would ship, and it is composed rather than chosen — no single preset above holds it. Five moves, four of them decisions: the card edge becomes a fill, the card corner comes down to --r-field with the chip keeping its pill, the big mono number comes down to 500, and the three stat tiles become the one module §4.5 already says they are. The fifth is not a taste — chrome `hairline` is forced by `fill`, because a sidebar at --surface beside cards at --surface is one enormous card. Density, colour and the heading weights stay exactly where they are. IT SPENDS NO PROPOSED TOKEN AND NEEDS NO RULING ON A VALUE — only your word on the positions. One thing this tuple cannot express: on the public report I would hold separation at `border`, because a stranger reads it once on a display nobody calibrated. Set that in /variants/compose and look at the report under both.",
    tuple: { ...BASE, separation: "fill", radius: "crisp", type: "poised", chrome: "hairline", figure: "rule" },
  },
];

/** The design-guardian's own tuple, named so it is not confused with a
 *  sixth style. It is the `guardian` preset and nothing else. */
export const RECOMMENDED = PRESETS.find((p) => p.id === "guardian")!.tuple;

export const PRESET_IDS = PRESETS.map((p) => p.id);

export const getPreset = (id: string) => PRESETS.find((p) => p.id === id);

/** Which axes a tuple actually moves. A variant that moves ten things at
 *  once cannot be composed from, so this is printed on every screen. */
export const movedAxes = (t: Tuple): AxisId[] =>
  AXIS_IDS.filter((id) => t[id] !== BASE[id]);

export const heldAxes = (t: Tuple): AxisId[] =>
  AXIS_IDS.filter((id) => t[id] === BASE[id]);

/** Tokens a tuple spends that the registry does not hold. Every screen
 *  that spends one carries a visible `proposed` mark (duty 3). */
export const proposedSpend = (t: Tuple): string[] => {
  const out: string[] = [];
  for (const axis of AXES) {
    const pos = axis.positions.find((p) => p.id === t[axis.id]);
    if (pos?.proposes) out.push(pos.proposes);
  }
  return out;
};

export const positionOf = (axisId: AxisId, posId: string) =>
  AXES.find((a) => a.id === axisId)?.positions.find((p) => p.id === posId);
