import type { ReactNode } from "react";

/**
 * The directions exploration's own layout. Its only job is to bring in
 * directions.css, every rule of which is scoped under `.d` — so nothing in
 * this subtree can reach the four specimen sheets, the five walkthroughs,
 * or /variants. Those three are the baselines these directions are judged
 * against, and a baseline that moved under the comparison would be no
 * baseline.
 *
 * Refusing all of this costs deleting src/app/directions/. Nothing outside
 * this directory was modified to make it run.
 */
import "./directions.css";

export default function DirectionsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
