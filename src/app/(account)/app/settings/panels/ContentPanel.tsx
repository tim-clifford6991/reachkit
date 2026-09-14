// BUILD §4.7 — Your content: the pages count, and Export everything.
//
// **"Always available" is enforced by having no condition.** REQ-078: the
// customer can export everything ReachKit wrote for them, always. No plan,
// setup or account state gates the control, and this file holds no branch
// around it.
"use client";

import type React from "react";
import { FileText } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { useAction } from "./useAction";
import type { SettingsModel } from "../model";

export function ContentPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const action = useAction();

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <FileText size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.content.title")}
        </h2>

        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-base-content/70">{copy("settings.content.pages")}</span>
          <span className="num min-w-0 text-3xl font-semibold wrap-anywhere" data-testid="content-pages">
            {p.settings.content.pages}
          </span>
        </div>

        <div className="min-w-0" data-testid="action-export">
          <button type="button" className="btn btn-outline btn-block" onClick={() => action.run("export")}>
            {copy("settings.content.export")}
          </button>
        </div>

        {action.line === null ? null : <p className="text-xs text-base-content/60 wrap-anywhere">{action.line}</p>}
      </div>
    </section>
  );
}
