// BUILD §4.6 — the one interval helper the editor and its preview share.
//
// Two pins, one mechanism: the preview re-renders at most every
// `PREVIEW_DEBOUNCE_MS` and the autosave fires after a pause of
// `AUTOSAVE_DEBOUNCE_MS`. Both are "the value, once it has stopped
// changing for n milliseconds", so both read from here rather than each
// growing a timer of its own — a second timer is a second place for a
// keystroke to be lost.
//
// The textarea itself is **never** debounced: what the customer typed is
// on screen the instant they type it. This delays only what is derived
// from it.
"use client";

import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}
