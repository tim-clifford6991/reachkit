"use client";

/**
 * CommandPalette — ⌘K / Ctrl+K wayfinding for the app shell.
 *
 * Renders a bare cmdk <Command> inside the Base UI <Dialog> (no Radix). Opens on
 * the keyboard shortcut or a `command-palette:open` window event (dispatched by
 * the sidebar affordance). Navigation comes straight from the shared APP_NAV
 * route map so it never drifts from the sidebar/breadcrumbs.
 *
 * Mounted once in the app layout; renders nothing until invoked.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { APP_NAV } from "@/lib/app/nav";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("command-palette:open", onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("command-palette:open", onOpenEvent);
    };
  }, []);

  // Close first, then run — so navigation/theme changes aren't interrupted by
  // the dialog teardown.
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl overflow-hidden p-0" showClose={false}>
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <Command loop>
          <CommandInput placeholder="Search or jump to…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading="Navigate">
              {APP_NAV.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`${item.label} ${item.hint ?? ""}`}
                  onSelect={() => run(() => router.push(item.href))}
                >
                  <span>{item.label}</span>
                  {item.hint && (
                    <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Actions">
              <CommandItem value="run a new scan" onSelect={() => run(() => router.push("/"))}>
                Run a new scan
              </CommandItem>
              <CommandItem
                value="toggle theme dark light mode"
                onSelect={() =>
                  run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
                }
              >
                Toggle theme
                <span className="ml-auto text-xs text-muted-foreground">
                  {resolvedTheme === "dark" ? "→ light" : "→ dark"}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
