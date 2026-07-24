/* @mirrors app/(marketing)/status/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { ComingSoon } from "./ComingSoon";
import { Footer } from "./Footer";

/**
 * StatusScreen — the `/status` page: NavBar + the shared ComingSoon placeholder
 * ("Status" · "Status page coming soon") + Footer. Mirrors the live page, which
 * renders <ComingSoon/> with these exact props.
 */
export interface StatusScreenProps {
  _unused?: never;
}

export function StatusScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <ComingSoon eyebrow="Status" title="Status page coming soon" blurb="A live status page with uptime history is on the way. If something looks broken in the meantime, let us know via the contact page." />
      <Footer />
    </div>
  );
}
