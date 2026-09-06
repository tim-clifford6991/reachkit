// tests/account/export/unzip.ts
//
// A reader for the stored-method archives `src/lib/account/export/zip.ts`
// writes — deliberately written from the ZIP specification rather than from
// that module, so a test asserting "the customer can open this" is not
// asserting "our writer agrees with itself". It walks the **central
// directory**, which is what every real reader does, so an archive whose
// entries are there but whose directory is not fails here as it would fail
// in the customer's own tool.
const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_SIZE = 22;

export interface ReadEntry {
  path: string;
  bytes: Uint8Array;
}

export function unzip(archive: Uint8Array): ReadEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.byteLength - END_SIZE;
  if (end < 0 || view.getUint32(end, true) !== END_SIGNATURE) {
    throw new Error("no end-of-central-directory record: this is not a complete zip");
  }

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ReadEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`central directory entry ${index} has the wrong signature`);
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const size = view.getUint32(at + 24, true);
    const offset = view.getUint32(at + 42, true);
    const path = decoder.decode(archive.subarray(at + 46, at + 46 + nameLength));

    if (view.getUint32(offset, true) !== LOCAL_SIGNATURE) {
      throw new Error(`local header for ${path} has the wrong signature`);
    }
    const localName = view.getUint16(offset + 26, true);
    const localExtra = view.getUint16(offset + 28, true);
    const start = offset + 30 + localName + localExtra;
    entries.push({ path, bytes: archive.subarray(start, start + size) });

    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
