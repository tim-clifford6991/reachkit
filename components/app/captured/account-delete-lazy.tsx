"use client";

/**
 * Client lazy boundary for the account-delete control. Keeps the delete panel's
 * client machinery (state + fetch) out of first-load — the app group is
 * bundle-budget-sensitive (see sign-out-button.tsx / competitor-setup-lazy.tsx).
 */

import dynamic from "next/dynamic";

export const AccountDeleteLazy = dynamic(
  () => import("@/components/app/captured/account-delete").then((m) => m.AccountDelete),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" style={{ minHeight: 44 }} />,
  },
);
