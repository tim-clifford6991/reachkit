import { buildMetadata } from "@/lib/seo";
export function generateStaticParams() { return [{ slug: "_placeholder" }]; }
export function generateMetadata({ params }: { params: { slug: string } }) {
  const { slug } = params; return buildMetadata({ title: `Report ${slug}`, path: `/report/${slug}` });
}
export default function ReportPage() { return <main>Report (Cycle 3)</main>; }
