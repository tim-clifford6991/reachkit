import { buildMetadata } from "@/lib/seo";
import { ScanStream } from "./scan-stream";

export function generateStaticParams() {
  return [{ id: "_placeholder" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return buildMetadata({ title: `Scanning your product…`, path: `/scan/${id}` });
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {id === "_placeholder" ? null : <ScanStream id={id} />}
    </main>
  );
}
