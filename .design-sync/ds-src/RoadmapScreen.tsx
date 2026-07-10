/* @mirrors app/(marketing)/roadmap/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { ComingSoon } from "./ComingSoon";
import { Footer } from "./Footer";

/**
 * RoadmapScreen — the `/roadmap` page: NavBar + the shared ComingSoon placeholder
 * ("Roadmap" · "Where ReachKit is headed") + Footer. Mirrors the live page, which
 * renders <ComingSoon/> with these exact props.
 */
export interface RoadmapScreenProps {
  _unused?: never;
}

export function RoadmapScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <ComingSoon eyebrow="Roadmap" title="Where ReachKit is headed" blurb="A public roadmap where you can see what's next and vote on it is in the works. Got a request? Reach us via the contact page." />
      <Footer />
    </div>
  );
}
