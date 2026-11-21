// A failed screen under /app, drawn inside the shell so the sidebar and dock stay; `(account)/error.tsx` keeps the shell's own failure.
"use client";

import type React from "react";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { copy } from "@/lib/presentation/copy";

const OVERVIEW = "/app";
const SENTINEL = "\u0000";

// The boundary may remount this screen when a retry throws again, so the path a retry was asked on outlives the instance.
let retriedOn: string | null = null;

function onConnection(change: () => void): () => void {
  window.addEventListener("online", change);
  window.addEventListener("offline", change);
  return () => {
    window.removeEventListener("online", change);
    window.removeEventListener("offline", change);
  };
}

function digestOf(error: unknown): string | null {
  const digest = error instanceof Error ? (error as Error & { digest?: unknown }).digest : undefined;
  return typeof digest === "string" && digest !== "" ? digest : null;
}

export default function AppError({ error, retry }: { error: unknown; retry: () => void }): React.JSX.Element {
  const pathname = usePathname();
  const [tried, setTried] = useState(() => pathname !== null && retriedOn === pathname);
  const [pending, startTransition] = useTransition();
  const offline = useSyncExternalStore(onConnection, () => !navigator.onLine, () => false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    retriedOn = null;
  }, [error]);

  const digest = digestOf(error);
  const [before = "", after = ""] = copy("chrome.error.app.code", { digest: SENTINEL }).split(SENTINEL);
  const status = offline ? copy("chrome.error.app.offline") : tried && !pending ? copy("chrome.error.app.again") : "";

  return (
    <div className="card card-border bg-base-100 mx-auto w-full min-w-0 max-w-prose" data-testid="account-error">
      <div className="card-body gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/70">{copy("chrome.error.eyebrow")}</p>
        <h1 ref={heading} tabIndex={-1} className="outline-none">
          {copy("chrome.error.app.title")}
        </h1>
        <p>{copy("chrome.error.app.line")}</p>
        <div className="card-actions mt-2 flex-col sm:flex-row">
          <button
            type="button"
            className="btn btn-primary min-h-11 w-full sm:w-auto"
            disabled={pending}
            onClick={() => {
              retriedOn = pathname;
              setTried(true);
              startTransition(() => retry());
            }}
          >
            {pending ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
            {copy("chrome.error.app.retry")}
          </button>
          {pathname === OVERVIEW ? null : (
            <Link href={OVERVIEW} className="btn btn-ghost min-h-11 w-full sm:w-auto">
              <ArrowLeft size={20} strokeWidth={1.75} aria-hidden />
              {copy("chrome.back-to-overview")}
            </Link>
          )}
        </div>
        <p role="status" className="text-sm">
          {status}
        </p>
        {digest === null ? null : (
          <p className="text-sm text-base-content/70">
            {before}
            <span className="font-mono">{digest}</span>
            {after}
          </p>
        )}
      </div>
    </div>
  );
}
