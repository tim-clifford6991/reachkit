// Canvas: Dashboard — the shell's class vocabulary.
//
// Tailwind utilities over the approved tokens. `shell.css` is still imported
// by the layout because the sibling app screens spend `.rk-prov` and its
// neighbours; nothing the shell itself draws reads a rule from it.

/** The frame. `--bg` is the ground the cards sit on. */
export const SHELL = "min-w-0 bg-(--bg) text-base-content";

/** Below the medium band the sidebar is hidden and its three parts collapse
 *  into this header — the same three destinations stay reachable. */
export const SHELL_TOP =
  "flex flex-col gap-(--s-3) border-b border-base-300 bg-base-100 p-(--s-3) lg:hidden";

/** One column below the medium band; the sidebar beside the well above it. */
export const SHELL_BODY = "block lg:flex lg:min-h-screen lg:items-stretch";

/** The column stretches so its rule runs the full height; the inner block is
 *  what sticks — a stretched flex item has no free space to stick within. */
export const SIDEBAR =
  "hidden lg:block lg:w-(--w-sidebar) lg:flex-none lg:border-r lg:border-base-300 lg:bg-base-100";
export const SIDEBAR_INNER =
  "flex min-w-0 flex-col justify-between gap-(--s-6) p-(--s-4) lg:sticky lg:top-0 lg:min-h-screen";

/** The brand and the Workspace nav at the top; the autopilot block and the
 *  domain at the foot, where the artboard puts them. */
export const SIDEBAR_TOP = "flex min-w-0 flex-col gap-(--s-4)";
export const SIDEBAR_FOOT = "flex min-w-0 flex-col gap-(--s-3)";
export const NAV_GROUP = "flex min-w-0 flex-col gap-(--s-2)";

/** The wordmark and its square mark — the same glyph the public header
 *  spends, from the same key, because the customer crosses between them. */
export const WORDMARK = "flex min-w-0 items-center gap-(--s-2) text-(length:--h4) font-bold";
export const MARK =
  "inline-flex size-(--s-5) flex-none items-center justify-center rounded-(--r-field) bg-primary text-primary-content";

/** Its own gutter is the surface's; what stays here is the column's share of
 *  the frame, and the one edge the surface cannot reach — the air between the
 *  sidebar's rule and the content. */
export const MAIN = "min-w-0 lg:flex-1 lg:ps-(--rk-gutter)";

/** Provenance: quiet, mono, at the ladder's floor rung. */
export const PROV = "num text-(length:--t-eyebrow) text-(color:--ink-3)";
