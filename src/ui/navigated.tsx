"use client";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

/**
 * Marks `<html data-navigated>` on the first client navigation, before that
 * screen paints, so `ENTER_APP` / `ENTER_PUBLIC` rise only on a navigation
 * and a document load paints its content at once. Renders nothing.
 */
export function NavigatedFlag(): null {
  const pathname = usePathname();
  const first = useRef(pathname);
  useLayoutEffect(() => {
    if (pathname !== first.current) document.documentElement.dataset.navigated = "";
  }, [pathname]);
  return null;
}
