// tests/presentation/sweeps/shell-state.ts
//
// The one mutable holder the provider mock reads. `vi.mock`'s factory is
// hoisted above every `const` in the test file, so the state it returns has
// to live in a module it can import — this one. Set it, render, read the
// document; nothing else in the sweeps holds shell state.
import type { ShellModel } from "@/app/(account)/app/_shell/model";

export const shellState: { current: ShellModel | null } = { current: null };
