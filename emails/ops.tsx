// The `ops` mail, for the preview server (#934). Its fixture and its
// document are `_preview.ts`'s; this file names the kind and nothing else.
import { previewDocument } from "./_preview";

export default async function OpsMail() {
  return previewDocument("ops");
}
