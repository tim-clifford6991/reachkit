// A Settings panel whose reads failed states one plain line in its own place, so the tab's other panels still draw.
import type React from "react";
import { unstable_rethrow } from "next/navigation";
import { copy } from "@/lib/presentation/copy";

/** Above the four 800 ms steps `readSettings` takes in turn; a read past it is a stalled one. */
const PANEL_DEADLINE_MS = 4_000;

export function Unread({ testId }: { testId: string }): React.JSX.Element {
  return (
    <section className="card card-border bg-base-100 min-w-0" data-testid={testId}>
      <div className="card-body">
        <p>{copy("settings.panel.unread")}</p>
      </div>
    </section>
  );
}

/** A tab's read, or `null` where it failed or ran past the deadline; a sign-in redirect still goes through. */
export async function landed<T>(work: Promise<T>, read: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`settings read timed out: ${read}`)), PANEL_DEADLINE_MS);
      }),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    console.warn(JSON.stringify({ event: "settings_read_failed", read, detail: String(error) }));
    return null;
  } finally {
    clearTimeout(timer);
  }
}
