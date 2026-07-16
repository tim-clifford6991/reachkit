/**
 * Should the blocking SetupOverlay render?
 *
 * The overlay inerts the ENTIRE app. That's right for a genuine first run and
 * wrong for an additional product: locking a healthy product #1 behind product
 * #2's competitor pick is exactly what the non-blocking add flow exists to avoid
 * (spec 2026-07-15). Profile is per-USER and stays mandatory.
 */
export function shouldBlockSetup(args: {
  onboardedAt: string | null;
  setupState: "profile" | "competitors" | "ready";
  appCount: number;
}): boolean {
  if (args.setupState === "ready") return false;
  if (args.setupState === "profile") return true; // per-user, mandatory
  return args.appCount <= 1; // competitors: first app only
}
