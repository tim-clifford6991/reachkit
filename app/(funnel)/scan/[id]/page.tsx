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
  return buildMetadata({ title: `Scan ${id}`, path: `/scan/${id}` });
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl p-8">
      {id === "_placeholder" ? null : <ScanStream id={id} />}
    </main>
  );
}
