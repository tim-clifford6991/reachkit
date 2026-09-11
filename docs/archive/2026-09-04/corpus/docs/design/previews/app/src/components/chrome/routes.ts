/**
 * The route index. One line each on what it shows and what is unsigned
 * about it — the same two facts the index page prints.
 */
export type RouteKind = "sheet" | "walk" | "variants" | "idiom";

export type PreviewRoute = {
  href: string;
  short: string;
  shows: string;
  unsigned: string;
  kind: RouteKind;
};

export const ROUTES: readonly PreviewRoute[] = [
  {
    href: "/tokens",
    short: "tokens",
    kind: "sheet",
    shows:
      "The WO-029 specimen as live code: every token in the running theme, the four ruled values, the type roles at their real letterforms, the numeral rule, the chart bounds.",
    unsigned:
      "WO-029 + WO-030. A signature releases both and makes this the specimen every later preview is read against. It flips no components.md row — it registers no component.",
  },
  {
    href: "/primitives",
    short: "primitives",
    kind: "sheet",
    shows:
      "The WO-031 sheet: all fifteen registered daisyUI primitives, every state components.md records, plus the three states it records as NOT registered.",
    unsigned:
      "WO-031 + WO-032. A signature flips all fifteen §1 rows from proposed to approved.",
  },
  {
    href: "/surfaces",
    short: "surfaces",
    kind: "sheet",
    shows:
      "The WO-033 sheet: Sidebar, CalendarGrid, DayPanel, AiDotMatrix — the ways-through slot in all three route cases, the never-padded grid with its four empty-day accounts.",
    unsigned:
      "WO-033 + WO-034. A signature flips all four §2 rows, makes the three layout tokens law, and closes §4 gaps 1 and 7.",
  },
  {
    href: "/charts",
    short: "charts",
    kind: "sheet",
    shows:
      "The WO-035 sheet: the five closed chart forms, the gapped pair drawn together, the three-state cell with the ring on the customer's own absent row.",
    unsigned:
      "WO-035 + WO-036. A signature flips all five §3 rows and closes §4 gap 6 or refuses it. No sixth chart form is added.",
  },
  {
    href: "/walk/report",
    short: "walk · report",
    kind: "walk",
    shows: "The free report at /scan/{domain} — BUILD §4.1's six modules, in order.",
    unsigned:
      "Assembled from registered components for review. NOT a signed preview of any work order, and no work order is released by looking at it.",
  },
  {
    href: "/walk/setup",
    short: "walk · setup",
    kind: "walk",
    shows: "Setup — BUILD §4.3's three decisions and one submit, plus the deep-pass progress screen.",
    unsigned:
      "Assembled from registered components for review. NOT a signed preview of any work order.",
  },
  {
    href: "/walk/app/overview",
    short: "walk · overview",
    kind: "walk",
    shows: "The app's default view — BUILD §4.5's five modules, inside the real shell.",
    unsigned:
      "Assembled from registered components for review. NOT a signed preview of any work order.",
  },
  {
    href: "/walk/app/calendar",
    short: "walk · calendar",
    kind: "walk",
    shows: "BUILD §4.6 — stage filters, the never-padded month grid, and the day panel open beside it.",
    unsigned:
      "Assembled from registered components for review. NOT a signed preview of any work order.",
  },
  {
    href: "/walk/draft",
    short: "walk · draft",
    kind: "walk",
    shows:
      "The draft view behind 'Read the full page' — grounded-fact highlight with its source line, claim-check badge, and the Markdown edit pane.",
    unsigned:
      "Assembled from registered components for review, and it spends two PROPOSED additions (Textarea, CodeBlock). NOT a signed preview of any work order.",
  },
  {
    href: "/idiom",
    short: "idiom",
    kind: "idiom",
    shows:
      "The card idiom the owner approved on 2026-09-02, and what it costs: six proposed values, one new registry row, four widenings, five raised questions, twenty-six owed strings.",
    unsigned:
      "An approved idiom is not a signed preview. No components.md row moves, no Signed-off: date follows, and two of the six values are the two the owner explicitly did not rule.",
  },
  {
    href: "/idiom/overview",
    short: "idiom · six boxes",
    kind: "idiom",
    shows:
      "Take A — BUILD §4.5's five modules as six boxes: one card per module, the three stat tiles broken out, and the two alerts as tinted panels with all three panel states drawn.",
    unsigned:
      "No work order, and the /walk/app/overview baseline beside it is untouched. It spends --r-card, --shadow-lift and --t-num-headline-face, all proposed.",
  },
  {
    href: "/idiom/signin",
    short: "idiom · sign in",
    kind: "idiom",
    shows:
      "The sign-in screen BUILD §4 never described — two panels, the accent ground, the glass card. Every string owner-supplied and transcribed verbatim.",
    unsigned:
      "It raises where the specimen score comes from and does not answer it. Nobody builds the panel until that is ruled.",
  },
  {
    href: "/idiom/landing",
    short: "idiom · landing",
    kind: "idiom",
    shows:
      "Hero on the accent ground with a real product component, the demo video block with its absent / poster / blocked states, then why-care · what-it-does · how-to-start.",
    unsigned:
      "One approved string and twenty-five owed. The structure is drawn and the argument is missing, because a preview may not write it.",
  },
  {
    href: "/variants",
    short: "variants",
    kind: "variants",
    shows:
      "Seven named axes — density, separation, radius, type contrast, colour application, chrome weight, data presentation — each isolated so one can be taken without the others, plus five presets on the overview and the report, and a composer.",
    unsigned:
      "An exploration. It renders the same registered components from the same mock data through the same JSX as the two walkthroughs; only a token set changes. It moves no components.md row, releases no work order, and two of its positions spend tokens the registry does not hold (--r-edge, --shadow-lift), both marked proposed wherever they appear.",
  },
  {
    href: "/variants/compose",
    short: "compose",
    kind: "variants",
    shows:
      "The seven axes unbundled: set each one, watch both whole screens, and hand back the tuple as a single block.",
    unsigned:
      "Composing a tuple is not a ruling. Nothing here is signed and no row moves.",
  },
];
