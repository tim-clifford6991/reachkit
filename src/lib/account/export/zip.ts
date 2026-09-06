// BUILD §9 — "Export = Markdown + assets zip, always available".
//
// A zip writer, in this repository, because the archive must open in the
// customer's own tools and adding a dependency to write forty bytes of
// header is not a trade this product makes. It writes the **stored** method
// (no compression): every byte of the customer's Markdown is in the archive
// exactly as it is in the database, which is the same promise
// `frontmatter.ts` makes about the body, and a reader that cannot inflate
// cannot exist. The cost is size; the benefit is that the archive is a
// function of its contents alone, so two runs produce identical bytes.
//
// Timestamps are the DOS epoch on every entry, deliberately: an archive
// stamped with the moment it was built would differ between two runs of the
// same export, and there is nothing about *when the customer pressed the
// button* that belongs in their content.
//
// Every entry is resolved before the first byte is written (`archive.ts`
// decides that ordering), so nothing here can fail part-way and leave a
// short archive wearing a valid trailer.

export interface ZipEntry {
  readonly path: string;
  readonly bytes: Uint8Array;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
/** Bit 11: the file name is UTF-8. Set on every entry so a title's
 *  transliteration is never the reader's guess. */
const UTF8_FLAG = 0x0800;
const STORED = 0;
const VERSION = 20;
/** 1980-01-01 00:00:00, the earliest moment the DOS field can hold. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const CRC_TABLE = (function build(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function localHeader(entry: ZipEntry, name: Uint8Array, crc: number): Uint8Array {
  const head = new Uint8Array(30 + name.length);
  const view = new DataView(head.buffer);
  view.setUint32(0, LOCAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORED, true);
  view.setUint16(10, DOS_TIME, true);
  view.setUint16(12, DOS_DATE, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, entry.bytes.length, true);
  view.setUint32(22, entry.bytes.length, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  head.set(name, 30);
  return head;
}

function centralHeader(
  entry: ZipEntry,
  name: Uint8Array,
  crc: number,
  offset: number
): Uint8Array {
  const head = new Uint8Array(46 + name.length);
  const view = new DataView(head.buffer);
  view.setUint32(0, CENTRAL_SIGNATURE, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, STORED, true);
  view.setUint16(12, DOS_TIME, true);
  view.setUint16(14, DOS_DATE, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, entry.bytes.length, true);
  view.setUint32(24, entry.bytes.length, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  head.set(name, 46);
  return head;
}

function endRecord(count: number, size: number, offset: number): Uint8Array {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, END_SIGNATURE, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  view.setUint16(20, 0, true);
  return end;
}

/** The whole archive as one buffer. Every entry is already in memory when
 *  this is called, so there is nothing to gain by deferring the join and
 *  something to lose: a stream that computed its own trailer could be
 *  cancelled between the last entry and the central directory, which is
 *  precisely the short-archive-wearing-a-valid-trailer case. */
export function zipBytes(entries: readonly ZipEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = utf8(entry.path);
    const crc = crc32(entry.bytes);
    const head = localHeader(entry, name, crc);
    parts.push(head, entry.bytes);
    central.push(centralHeader(entry, name, crc, offset));
    offset += head.length + entry.bytes.length;
  }

  const centralSize = central.reduce((sum, head) => sum + head.length, 0);
  const all = [...parts, ...central, endRecord(entries.length, centralSize, offset)];
  const total = all.reduce((sum, part) => sum + part.length, 0);

  const out = new Uint8Array(total);
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The archive as the response body. One chunk per entry-sized slice so a
 *  large archive is handed to the transport in pieces rather than as one
 *  allocation the runtime has to copy again. */
export function zipStream(entries: readonly ZipEntry[]): ReadableStream<Uint8Array> {
  const bytes = zipBytes(entries);
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(sent + ZIP_CHUNK_BYTES, bytes.length);
      controller.enqueue(bytes.subarray(sent, end));
      sent = end;
    },
  });
}

const ZIP_CHUNK_BYTES = 64 * 1024;
