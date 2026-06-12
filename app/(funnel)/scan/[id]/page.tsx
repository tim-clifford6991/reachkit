import { buildMetadata } from "@/lib/seo";
export function generateStaticParams() { return [{ id: "_placeholder" }]; }
export function generateMetadata({ params }: { params: { id: string } }) {
  const { id } = params; return buildMetadata({ title: `Scan ${id}`, path: `/scan/${id}` });
}
export default function ScanPage() { return <main>Scan (funnel — Cycle 1–2)</main>; }
