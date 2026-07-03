import { Suspense } from "react";
import { TestCustomersFixture } from "./fixture";

/**
 * Server wrapper: the fixture body renders thread freshness via Date.now(),
 * which Next 16 only allows under a Suspense boundary during prerender.
 */
export default function TestCustomersViewPage() {
  return (
    <Suspense fallback={null}>
      <TestCustomersFixture />
    </Suspense>
  );
}
