/**
 * Which Ease × Impact quadrant a play falls in. Mirrors the scatter's quadrant
 * labels (high ease + high impact = top-right = "Quick win"). The 0.5 midpoint
 * counts as the high side so a play exactly on the line reads optimistically.
 */
export type Quadrant = "Quick win" | "Big bet" | "Fill-in" | "Low priority";

export function quadrantOf(ease: number, impact: number): Quadrant {
  const easy = ease >= 0.5;
  const high = impact >= 0.5;
  if (easy && high) return "Quick win";
  if (!easy && high) return "Big bet";
  if (easy && !high) return "Fill-in";
  return "Low priority";
}
