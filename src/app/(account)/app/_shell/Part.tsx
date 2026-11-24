// One part of a screen whose read failed, in its own slot, so the rest of the screen stands; a slow read never lands here.
"use client";

import type React from "react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { catchError, type ErrorInfo } from "next/error";
import { copy } from "@/lib/presentation/copy";

export function onConnection(change: () => void): () => void {
  window.addEventListener("online", change);
  window.addEventListener("offline", change);
  return () => {
    window.removeEventListener("online", change);
    window.removeEventListener("offline", change);
  };
}

/** The failed part; `retry` re-reads only its own boundary, and without one the screen is refreshed. */
export function Failed({ retry, testId }: { retry?: () => void; testId?: string }): React.JSX.Element {
  const router = useRouter();
  const [tried, setTried] = useState(false);
  const [pending, startTransition] = useTransition();
  const offline = useSyncExternalStore(onConnection, () => !navigator.onLine, () => false);
  const status = offline ? copy("chrome.error.app.offline") : tried && !pending ? copy("chrome.error.app.again") : "";
  return (
    <section className="card card-border bg-base-100 min-w-0" data-testid={testId ?? "part-failed"}>
      <div className="card-body gap-3">
        <p>{copy("chrome.error.part.line")}</p>
        <div className="card-actions">
          <button
            type="button"
            className="btn btn-outline min-h-11 w-full sm:w-auto"
            disabled={pending}
            onClick={() => {
              setTried(true);
              startTransition(() => (retry === undefined ? router.refresh() : retry()));
            }}
          >
            {pending ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
            {copy("chrome.error.app.retry")}
          </button>
        </div>
        <p role="status" className="text-sm">
          {status}
        </p>
      </div>
    </section>
  );
}

function PartFallback(props: { testId?: string }, { retry }: ErrorInfo): React.JSX.Element {
  return <Failed retry={retry} testId={props.testId} />;
}

/** A boundary around one part: put it outside the part's `<Suspense>`. */
export const Part = catchError(PartFallback);
