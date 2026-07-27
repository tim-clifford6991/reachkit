/**
 * Should the blocking SetupOverlay render?
 *
 * Onboarding a product is a BLOCKING step (owner rule 2026-07-27): until it's
 * done — scanned + competitors picked — the user can't navigate the app for that
 * product. This holds for the FIRST app AND every new one alike. The old
 * "competitors blocks only on the first app" carve-out (spec 2026-07-15) existed
 * to avoid inerting a healthy product #1 behind product #2's pick — but the
 * overlay now carries a SWITCH-PRODUCT + SETTINGS escape, so the user can always
 * jump back to a ready product (which flips setupState → ready → unblocks). So the
 * block is universal; the escape is what keeps product #1 reachable. Profile is
 * per-USER and stays mandatory.
 */
export function shouldBlockSetup(args: {
  onboardedAt: string | null;
  setupState: "profile" | "competitors" | "ready";
  appCount: number;
}): boolean {
  if (args.setupState === "ready") return false;
  return true; // profile (per-user) OR competitors (per-product) — both block, with escapes
}
