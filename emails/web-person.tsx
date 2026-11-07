// The `web-person` mail, for the preview server. Its fixture and its document are `_preview.ts`'s.
import { previewDocument } from "./_preview";

export default async function WebPersonMail() {
  return previewDocument("web-person");
}
