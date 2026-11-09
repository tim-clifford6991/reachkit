// The stub standing for `src/lib/mail/`. Reaching it at any depth is the
// violation REQ-071 criterion 17 forbids.
import { sendEmail } from "@/lib/mail/send";
export function score(domain: string): number {
  void sendEmail;
  return domain.length;
}
