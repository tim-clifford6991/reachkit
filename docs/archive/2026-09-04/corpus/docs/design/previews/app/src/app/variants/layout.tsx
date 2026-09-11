import type { ReactNode } from "react";

/**
 * The variant exploration's own layout. Its ONLY job is to bring in
 * variants.css, which is scoped entirely under `.v` — so nothing in this
 * subtree can reach the four specimen sheets or the five walkthroughs, and
 * the baseline they are compared against cannot drift under the
 * comparison.
 */
import "./variants.css";

export default function VariantsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
