// src/ui/components/custom/index.ts — BUILD §2.2
//
// §2.2 closes custom CSS at five surfaces: "the calendar grid, the day
// panel, the AI dot-matrix, chart SVGs, and the sidebar — nothing else."
// Two of the five are components and live here; the sidebar is the app
// shell's (`src/ui/layout/shell.css`) and the chart SVGs are §2.4's closed
// inventory (issue #11). The AI dot-matrix is issue #10's other half.
//
// They sit under `custom/` rather than beside the fifteen daisyUI
// primitives so `src/ui/components/index.ts` stays closed at fifteen — the
// property `tests/ui/components-2.test.tsx` asserts, and the reason an
// unregistered widget has nowhere to be exported from (BP-018 decision 1).
export { CalendarGrid, type CalendarGridCell } from "./CalendarGrid";
export { DayPanel, DayPanelLayout } from "./DayPanel";
