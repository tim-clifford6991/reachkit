// SPEC §7 (issue 1532) — the sentences `TakeDown.tsx` says, read from the
// registry where the caller renders, so the client control carries strings
// and not the registry.
import { TAKE_DOWN } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import type { PutBackWords, TakeDownWords } from "./TakeDown";

export function takeDownWords(): TakeDownWords {
  const days = String(TAKE_DOWN.PUT_BACK_DAYS);
  return {
    action: copy("draft.action.take-down"),
    question: copy("draft.take-down.question", { days }),
    confirm: copy("draft.take-down.confirm"),
    keep: copy("draft.take-down.keep"),
    done: copy("draft.take-down.done", { days }),
    refused: copy("draft.take-down.refused"),
  };
}

export function putBackWords(): PutBackWords {
  return {
    action: copy("draft.action.put-back"),
    done: copy("draft.put-back.done"),
    refused: copy("draft.put-back.refused"),
  };
}
