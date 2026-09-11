import type { ReactNode } from "react";

/**
 * The approved card idiom's own layout. Its only job is to bring in
 * idiom.css, every rule of which is scoped under `.ci` — so nothing in this
 * subtree can reach the four specimen sheets, the five walkthroughs,
 * /variants or /directions. Those are the record of what was drawn before
 * the ruling, and a record that moved under a later ruling would be no
 * record.
 *
 * Refusing all of this costs deleting src/app/idiom/ and reverting the six
 * proposed declarations in globals.css §1c. Nothing else was modified to
 * make it run.
 */
import "./idiom.css";

export default function IdiomLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
