// BUILD §2.2 — the registered component set — the closed fifteen.
// src/ui/components/index.ts
//
// BP-018 `## Public interface`, verbatim: "Registered components only —
// daisyUI primitives plus the five allowed customs." WO-268 file plan:
// "Barrel exporting exactly the fifteen BP-018 lists; written once, closed
// at fifteen." Nothing outside this list is exported from this module — an
// unregistered widget has nowhere to be exported from (BP-018 decision 1).
export { Btn } from "./Btn";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { Badge } from "./Badge";
export { Alert } from "./Alert";
export type { AlertTone } from "./Alert";
export { Stat } from "./Stat";
export type { StatProps } from "./Stat";
export { Tabs } from "./Tabs";
export type { TabItem } from "./Tabs";
export { Table } from "./Table";
export type { TableColumn } from "./Table";
export { Progress } from "./Progress";
export { Toggle } from "./Toggle";
export { Steps } from "./Steps";
export type { StepItem } from "./Steps";
export { Join } from "./Join";
export { Collapse } from "./Collapse";
export { Input } from "./Input";
export type { InputProps } from "./Input";
export { Divider } from "./Divider";
export { Kbd } from "./Kbd";
