// The faces `/style.css` names, on the customer's own host. Every file is written during
// `next build`; any other name answers 404.
import { readFile } from "node:fs/promises";
import { hostedFontFaces } from "../faces";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ file: string }[]> {
  const { files } = await hostedFontFaces();
  return [...files.keys()].map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await params;
  const source = (await hostedFontFaces()).files.get(file);
  if (source === undefined) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(await readFile(source)), {
    headers: { "Content-Type": "font/woff2" },
  });
}
