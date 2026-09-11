/**
 * THE IDIOM'S LEDGER — what the approved idiom costs, in one place.
 *
 * Everything in this file is REVIEWER-FACING ANNOTATION, drawn in --pv-*
 * chrome and never inside a product surface. It is not customer copy and no
 * screen renders a word of it.
 *
 * It is a file rather than prose inside the index route for one reason: the
 * same four lists have to agree with tokens.md §9 and components.md §7, and
 * a list that is retyped in a JSX tree is a list that drifts from its own
 * law book by the second edit.
 */

export const IDIOM_ROUTES: readonly { href: string; shows: string; unsigned: string }[] = [
  {
    href: "/idiom/overview",
    shows:
      "Take A — six boxes. BUILD §4.5's five modules as six: one card per module with the three stat tiles broken out as three separate boxes. The two overview alerts become tinted panels, and the panel's three states are drawn beneath.",
    unsigned:
      "No work order. It is the idiom applied to a screen the walkthroughs already draw, and the walkthrough beside it is untouched. It flips no components.md row and spends three proposed values.",
  },
  {
    href: "/idiom/signin",
    shows:
      "The sign-in screen BUILD §4 never described: two panels at and above --breakpoint-lg, the accent ground, the glass card. Every string owner-supplied and transcribed verbatim.",
    unsigned:
      "It spends --grad-accent, --on-accent-quiet and --w-form, all proposed. It raises the specimen-score question and does not answer it; nobody builds this panel until that is ruled.",
  },
  {
    href: "/idiom/landing",
    shows:
      "Hero on the accent ground with a real product component, the demo video block with its three asset states, and three narrative sections — why care, what it does, how to start.",
    unsigned:
      "One approved string (BUILD §3's tagline) and twenty-five owed. The structure is drawn; the argument is missing because a preview may not write it.",
  },
];

export const PROPOSED_TOKENS: readonly {
  name: string;
  value: string;
  derivation: string;
  reversal: string;
  notRuled?: boolean;
}[] = [
  {
    name: "--r-card",
    value: "18px",
    notRuled: true,
    derivation:
      "The card radius the idiom draws, against the RULED --r-box 14px. Kept as a second variable rather than an edit of --r-box, so both can exist until the owner rules — replacing a ruled value by re-drawing is what rule 1.2 forbids in the direction that matters here.",
    reversal:
      "One declaration. Every idiom surface names --r-card and nothing else, so refusing it is one line and every card falls back to the ruled 14.",
  },
  {
    name: "--t-num-headline-face",
    value: "var(--font-mono)",
    notRuled: true,
    derivation:
      "The one token that flips the headline numeral between JetBrains Mono and the sans at 800. Default is mono, which is what BUILD §2.3 states verbatim and therefore what conforms. It reaches the headline figure only; a date, a URL, a search query and a provenance line stay mono either way, and tabular-nums comes from .num and cannot be dropped by it.",
    reversal:
      "One declaration. Ruling sans costs changing one value; ruling mono costs deleting the token and one CSS rule.",
  },
  {
    name: "--shadow-lift",
    value: "0 1px 2px … , 0 6px 16px … (light) · re-inked at a second alpha (dark)",
    derivation:
      "'Separated by shadow, never a border' is the idiom's first rule and --shadow-card is a 1px hairline that cannot carry a card's edge alone. Its dark value is the light geometry re-inked at a second alpha — §2.1's own pattern for the -bg/-line pairs and the construction the owner's dark --shadow-card ruling took. Raised by /variants, and its declaration moved out of that subtree into globals.css §1c when an endorsed idiom started spending it (rule 2.4: one home).",
    reversal:
      "One declaration and one rule. Refusing it means cards keep the hairline border, which is the four sheets' drawing unchanged.",
  },
  {
    name: "--grad-accent",
    value: "radial --on-accent at 28% over flat --accent",
    derivation:
      "design/ has no gradient anywhere and the token set has no second accent stop — so the stops are DERIVED rather than minted: the ground is --accent and the highlight is --on-accent at 28%, which is BUILD §2.1's own stated alpha ('+ matching -bg/-line at 12%/28% alpha'). No colour is invented. The three position proportions are geometry inside the element's own box, the same class of value as an SVG coordinate, which tokens.md §7 already exempts.",
    reversal:
      "One declaration and two call sites — the sign-in panel and the landing hero, which deliberately spend the same surface rather than two.",
  },
  {
    name: "--on-accent-quiet",
    value: "--on-accent mixed 72% toward --accent",
    derivation:
      "The quiet ink on an accent ground. --ink-3 is the quiet ink on --bg and the set has no on-accent equivalent, so the sign-in panel's mono domain line had nothing to take. Mixed TOWARD THE GROUND rather than to transparency, because that is the relationship --ink-3 has to --ink; mixing to transparent at a low alpha would have put running text under any contrast floor.",
    reversal: "One declaration. Refusing it means the domain line takes full --on-accent.",
  },
  {
    name: "--w-form",
    value: "420px",
    derivation:
      "A third content measure. Neither existing one fits a single form column: at the 15px body, --w-read 704 runs to about 94 characters, outside the 45–75 measure, and 420 runs to about 56, inside it. It is also the column the page the owner endorsed draws.",
    reversal: "One declaration and two call sites.",
  },
];

export const REGISTRY_MOVES: readonly { name: string; kind: string; why: string }[] = [
  {
    name: "ActionPanel",
    kind: "NEW ROW — proposed",
    why: "'Anything asking the customer to act is a tinted panel.' Alert is the nearest registered thing and it is the wrong one: an alert states a fact and takes four tones, where a panel asks for a decision and may take only accent or warn — --ok/--warn/--bad are state colours (§2.5) and a request is not a state. The panel also carries an icon chip, a bold title, a dim line and a pill CTA, none of which Alert's contract has. Three states: default · in-flight · withheld, where withheld carries a required account and has no cta member at all, so a disabled button with no explanation cannot be built.",
  },
  {
    name: "Card — head slot",
    kind: "WIDENING — proposed",
    why: "The registered Card takes an eyebrow and a verdict. The idiom's head is an icon chip, the eyebrow and an optional right-hand pill, above the verdict. Three slots the contract does not name.",
  },
  {
    name: "Btn — outline secondary, quiet tertiary, pill radius",
    kind: "WIDENING — proposed",
    why: "BUILD §2.2 gives btn +primary/ghost/sm/block and the registered row follows it. The idiom needs three ranks, not two, and all three at --r-pill. Rank is what makes 'one primary action per screen' checkable by looking; with two ranks a secondary and a tertiary are the same button.",
  },
  {
    name: "Stat — label placeable in the head",
    kind: "WIDENING — proposed",
    why: "Stat prints its own eyebrow label. The idiom's card head already carries one, and a tile with two eyebrows states the same claim twice (rule 2.4). Everything else registered about Stat is unchanged and deliberately so: the mono numeral utility, the delta-XOR-goal union, and the three measured/measured-zero/unmeasured states.",
  },
  {
    name: "Progress — on-accent skin",
    kind: "WIDENING — proposed",
    why: "The sign-in glass card needs a determinate bar on an accent ground, where --sunk and --chart-* have no contrast. Track and fill take --on-accent at the same two stated alphas. It stays determinate — value and max are both required and neither is nullable — and it is NOT a sixth chart form.",
  },
];

export const RAISED: readonly { title: string; body: string }[] = [
  {
    title: "Where does the sign-in panel's specimen score come from?",
    body:
      "The right panel shows a Discoverability Score for a named domain to a stranger who has not signed in. A real recent scan, a fixed specimen everyone sees, or a placeholder — the three are not equivalent. Only the first is a measurement; the second is a specimen and must be labelled as one; the third is a number the product invents and shows to a customer, which is rule 1.2. The same question binds the landing hero's component, which is one question and not two. Nobody builds either surface until it is answered.",
  },
  {
    title: "Did 'only the two endpoints labelled' mean the axis ticks too?",
    body:
      "GrowthLine already labels exactly two values — the endpoint, and the start value in the footnote pair, which is BUILD §4.5's own sentence. The marks under the plot carry a WEEK TICK, not a value. If the ruling meant those ticks as well, that is a change to a registered chart's contract and not a CSS rule, and §2.4's 'every bar and point direct-labelled' is on the other side of it. Raised, not taken.",
  },
  {
    title: "The sign-in field has no visible label and the registry requires one.",
    body:
      "components.md §1: Input requires a placeholder AND a label, never defaulted. The page the owner endorsed shows a placeholder and no label. Either the owner writes the label (it is S1 in the owed list) or Input's row gains an arm for a visually-hidden one. Both are rulings; the bracket is rendered on the screen in the meantime.",
  },
  {
    title: "The reference screenshot's bar and its figure disagree.",
    body:
      "The glass card sets the score at 47/100 and draws its bar at roughly 40%. The bar and the numeral state one fact, so two renderings that disagree are rule 2.4's second copy arriving as a picture. This preview draws the bar at the figure and records the deviation rather than copying it. If the 40% is meaningful — a different measure, a different denominator — then it is a second fact and needs its own label.",
  },
  {
    title: "BUILD §4.7's Settings Billing card is in question.",
    body:
      "Checkout, billing, invoicing and billing notifications are Stripe's entirely, so what survives of a Billing card that lists plan, next invoice, card, invoices, Update card and Cancel plan is an open question the analyst is working out. It is NOT redesigned here on a guess. components.md §7 records it as pending an owner ruling so nobody builds it in the meantime.",
  },
];

export const OWED_STRINGS: readonly { id: string; where: string; what: string }[] = [
  { id: "S1", where: "/idiom/signin", what: "The email field's label. The endorsed page shows none; the registered Input requires one." },
  { id: "L1", where: "/idiom/landing · hero", what: "The subline under the tagline." },
  { id: "L2", where: "/idiom/landing · hero", what: "The hero field's label." },
  { id: "L3", where: "/idiom/landing · hero", what: "The hero field's placeholder." },
  { id: "L4", where: "/idiom/landing · hero", what: "The hero CTA's label — the one primary action on the page." },
  { id: "L5", where: "/idiom/landing · hero", what: "The eyebrow on the product component: what the visitor is looking at." },
  { id: "L6", where: "/idiom/landing · hero", what: "The one dim line under the product component." },
  { id: "L7", where: "/idiom/landing · demo", what: "The demo section's eyebrow." },
  { id: "L8", where: "/idiom/landing · demo", what: "The demo section's heading." },
  { id: "L9", where: "/idiom/landing · demo", what: "The line shown when the player is blocked or refused." },
  { id: "L10", where: "/idiom/landing · demo", what: "The label on the control that opens the video at its own address." },
  { id: "L11", where: "/idiom/landing · why care", what: "Section 1's eyebrow." },
  { id: "L12", where: "/idiom/landing · why care", what: "Section 1's heading." },
  { id: "L13", where: "/idiom/landing · why care", what: "Section 1's body." },
  { id: "L14", where: "/idiom/landing · what it does", what: "Section 2's eyebrow." },
  { id: "L15", where: "/idiom/landing · what it does", what: "Section 2's heading." },
  { id: "L16", where: "/idiom/landing · what it does", what: "Card 1's title." },
  { id: "L17", where: "/idiom/landing · what it does", what: "Card 1's one line." },
  { id: "L18", where: "/idiom/landing · what it does", what: "Card 2's title." },
  { id: "L19", where: "/idiom/landing · what it does", what: "Card 2's one line." },
  { id: "L20", where: "/idiom/landing · what it does", what: "Card 3's title." },
  { id: "L21", where: "/idiom/landing · what it does", what: "Card 3's one line." },
  { id: "L22", where: "/idiom/landing · how to start", what: "Section 3's eyebrow." },
  { id: "L23", where: "/idiom/landing · how to start", what: "Section 3's heading." },
  { id: "L24", where: "/idiom/landing · how to start", what: "Section 3's body." },
  { id: "L25", where: "/idiom/landing · how to start", what: "Section 3's CTA label — the same action as L4, stated a second time, not a second action." },
];
