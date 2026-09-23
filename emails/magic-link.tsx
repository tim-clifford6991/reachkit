// The `magic-link` mail, for the preview server (#934). Its fixture and its
// document are `_preview.ts`'s; this file names the kind and nothing else.
import { previewDocument } from "./_preview";

export default async function MagicLinkMail() {
  return previewDocument("magic-link");
}
