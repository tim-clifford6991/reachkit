"use client";

/**
 * TeardownSearch — the only client island on /teardowns.
 *
 * A controlled input that, on submit, navigates to `/teardowns?q=...`
 * (resetting to page 1). No client-side filtering — the server does the
 * search via `countPublicScans`/`listPublicScans`.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TeardownSearch({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        router.push(trimmed ? `/teardowns?q=${encodeURIComponent(trimmed)}` : "/teardowns");
      }}
      role="search"
      aria-label="Search live scans by domain"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by domain…"
        style={{
          width: "100%",
          maxWidth: 320,
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          color: "var(--c-ink)",
          background: "var(--c-surface)",
          border: "1px solid var(--c-line)",
          borderRadius: 9,
          padding: "10px 14px",
        }}
      />
    </form>
  );
}
