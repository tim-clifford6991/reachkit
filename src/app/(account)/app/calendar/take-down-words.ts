// SPEC §7 (R9) — the sentences `TakeDown.tsx` says, read from the registry
// where the caller renders, so the client control carries strings and not
// the registry.
import { copy } from "@/lib/presentation/copy";
import type { ControlWords } from "./TakeDown";

export function stopWords(): ControlWords {
  return {
    action: copy("draft.action.veto"),
    done: copy("draft.stop.done"),
    refused: copy("draft.stop.refused"),
  };
}

export function putBackWords(): ControlWords {
  return {
    action: copy("draft.action.put-back"),
    done: copy("draft.put-back.done"),
    refused: copy("draft.put-back.refused"),
  };
}
