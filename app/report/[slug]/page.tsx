import { buildMetadata } from "@/lib/seo";
export function generateStaticParams() { return [{ slug: "_placeholder" }]; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; return buildMetadata({ title: `Report ${slug}`, path: `/report/${slug}` });
}
export default function ReportPage() { return <main>Report (Cycle 3)</main>; }
