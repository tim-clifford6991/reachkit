// Settings' shared frame: the class lists every one-screen tab spells once.

/** Two independent columns from `lg`, each a stack of cards; one stack below it. */
export const CARD_GRID = "grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2";
export const CARD_COLUMN = "flex min-w-0 flex-col gap-4";

/** A Settings card, kept short enough that a tab fits a 1280×800 window. */
export const CARD = "card card-border min-w-0 bg-base-100";
export const CARD_BODY = "card-body min-w-0 gap-1.5 p-4";
export const CARD_TITLE = "card-title min-w-0 flex-wrap text-(length:--h3)";
export const CARD_LEAD = "text-sm text-base-content/70 wrap-anywhere";
/** A card's last row: a dated line and the one action that starts work. */
export const CARD_FOOT = "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-base-300 pt-2";

/** The edit dialog's box: centred from `sm`, the whole screen below it. */
export const DIALOG_BOX =
  "modal-box flex max-h-[90dvh] min-w-0 flex-col gap-4 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none";

/** A control's target: 44px below `lg`, the plate's 32px on a pointer screen from `lg` (WCAG 2.5.8). */
export const TARGET = "btn-sm min-h-11 lg:min-h-8";
/** The secondary button that starts work from a card's foot. */
export const SOFT = `btn btn-soft btn-primary ${TARGET}`;
