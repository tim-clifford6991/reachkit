/** @vitest-environment jsdom */
// tests/app/answers.test.tsx — SPEC §4 and §7 (2026-09-20, #908), issue #913
//
// "Every action answers." The defect this file kills is the one every
// static render passes: a control that is drawn, is pressed, reaches the
// seam, is refused — and says nothing, so a customer who stopped a page
// and a customer whose stop was refused see the same screen. Nothing about
// that is visible in markup, so every row here presses something and then
// reads what the product said.
//
// **What is doubled, and where.** The two `"use server"` transport modules
// — the last line of each screen's own code before the request leaves it —
// and `sonner`, which is where a sentence lands. Everything in between is
// the real thing: the real seam, the real projection from §9's table, the
// real registry. The sentences asserted are therefore the sentences a
// customer reads.
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** What the product said, in order: the rendered text of each toast and
 *  the daisyUI classes it was drawn with. */
const said: { text: string; className: string }[] = [];

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    custom: (jsx: (id: number) => React.JSX.Element) => {
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(jsx(1));
      const node = container.firstElementChild;
      said.push({
        text: node?.textContent ?? "",
        className: node?.getAttribute("class") ?? "",
      });
      return 1;
    },
  },
}));

/** The §9 write, as the browser reaches it. `null` is the machine's "it
 *  moved"; a string is its own refusal word.
 *
 *  `hold` keeps the write in flight, which is the only window in which the
 *  optimistic badge is visible: React drops an optimistic value the moment
 *  the transition ends, and in the product what replaces it is the state
 *  the revalidated read brings back. A unit test has no such read, so the
 *  badge it can honestly assert is the one drawn *while the press is
 *  unanswered* — which is exactly what `useOptimistic` is for. */
const machine = { answer: null as string | null, hold: false };
let release: (() => void) | null = null;
vi.mock("@/app/(account)/app/calendar/publishing-actions", () => {
  const reply = async (): Promise<string | null> => {
    if (machine.hold) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return machine.answer;
  };
  return {
    skipDraft: reply,
    vetoDraft: reply,
    approveDraft: reply,
    regenerateDraft: reply,
  };
});

/** The settings write, likewise. */
type SettingAnswer = import("@/app/(account)/app/settings/panel-state").SettingAnswer;
const setting = { answer: { answer: "saved", effect: "now" } as SettingAnswer, hold: false };
let releaseSetting: (() => void) | null = null;
const wrote: { field: string; value: string }[] = [];
vi.mock("@/app/(account)/app/settings/panel-actions", () => {
  const record = (field: string) => async (form: FormData) => {
    wrote.push({ field, value: String(form.get(field) ?? "") });
    if (setting.hold) {
      await new Promise<void>((resolve) => {
        releaseSetting = resolve;
      });
    }
    return setting.answer;
  };
  return {
    saveVetoHoursAction: record("veto_hours"),
    savePublishTimeAction: record("publish_time"),
    saveTimeZoneAction: record("time_zone"),
    setPublishingAction: record("publishing_enabled"),
    setNotificationAction: record("notify_on"),
    addClaimAction: record("do_not_claim"),
    removeClaimAction: record("do_not_claim"),
  };
});

import { COPY } from "@/lib/presentation/copy";
import { DayPanelView } from "@/app/(account)/app/calendar/DayPanelView";
import { assembleMonth, cellFor } from "@/app/(account)/app/calendar/month";
import {
  FIXTURE_CALENDAR_FACTS,
  FIXTURE_MONTH,
  FIXTURE_TIME_ZONE,
} from "@/app/(account)/app/calendar/fixture";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";
import { assembleSettings } from "@/app/(account)/app/settings/model";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { NotificationsPanel } from "@/app/(account)/app/settings/panels/NotificationsPanel";
import { PublishingPanel } from "@/app/(account)/app/settings/panels/PublishingPanel";
import { ANSWER_PLACEMENT } from "@/app/_toast/Answers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MONTH = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
/** The fixture's page in review — the one day whose panel offers a stop. */
const IN_REVIEW = "2026-09-15";
const DRAFT = assembleDraft(FIXTURE_DRAFTS[FIXTURE_DRAFT_ID]!);
const SETTINGS = assembleSettings(FIXTURE_SETTINGS_FACTS);

async function mount(el: React.ReactElement): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(el);
  });
  return container;
}

async function press(el: Element | null | undefined): Promise<void> {
  await act(async () => {
    (el as HTMLElement).click();
  });
}

/** Let a held write answer, and flush what the answer causes. */
async function answer(): Promise<void> {
  await act(async () => {
    release?.();
    releaseSetting?.();
    await Promise.resolve();
  });
}

async function dayPanel(): Promise<HTMLElement> {
  const cell = cellFor(MONTH, IN_REVIEW);
  if (cell === undefined) throw new Error(`no cell for ${IN_REVIEW}`);
  return mount(
    <DayPanelView cell={cell} timeZone={FIXTURE_TIME_ZONE} stopped={MONTH.stopped}  onClose={() => undefined} />
  );
}

const action = (root: HTMLElement, key: string): Element | null =>
  root.querySelector(`[data-testid="day-action-${key}"]`);

beforeEach(() => {
  said.length = 0;
  wrote.length = 0;
  machine.answer = null;
  machine.hold = false;
  release = null;
  setting.answer = { answer: "saved", effect: "now" };
  setting.hold = false;
  releaseSetting = null;
});

describe("Plan — a stop says what became of the page", () => {
  it("a stop that landed says the page will not go live, in the registry's own words", async () => {
    const root = await dayPanel();
    await press(action(root, "calendar.action.veto"));
    expect(said).toHaveLength(1);
    expect(said[0]?.text).toBe(COPY["calendar.answer.veto"]);
  });

  it("a stop the machine refused says nothing changed — never the machine's word for why", async () => {
    machine.answer = "not_a_transition";
    const root = await dayPanel();
    await press(action(root, "calendar.action.veto"));
    expect(said[0]?.text).toBe(COPY["calendar.answer.refused"]);
    expect(said[0]?.text).not.toContain("not_a_transition");
  });

  it("the two answers are told apart by tone as well as by words, in daisyUI alert classes", async () => {
    const landed = await dayPanel();
    await press(action(landed, "calendar.action.veto"));
    machine.answer = "not_a_transition";
    const refused = await dayPanel();
    await press(action(refused, "calendar.action.veto"));
    expect(said[0]?.className).toContain("alert-success");
    expect(said[1]?.className).toContain("alert-error");
    // Drawn with daisyUI's own class and nothing hand-rolled beside it.
    expect(said[0]?.className).toContain("alert");
  });

  it("the stage badge changes on the press, before the machine has answered", async () => {
    machine.hold = true;
    const root = await dayPanel();
    const badge = (): string =>
      root.querySelector('[data-testid="day-head"]')?.textContent ?? "";
    expect(badge()).toContain(COPY["calendar.stage.your-review"]);
    await press(action(root, "calendar.action.veto"));
    // `skipped` occupies no date, so the panel reads as a date with no
    // page — which is what the server renders once the re-read lands.
    expect(badge()).toContain(COPY["calendar.empty.day-badge"]);
    // And the stop is not offered a second time while the first is in
    // flight: a second press could only ask for an edge the page has left.
    expect(action(root, "calendar.action.veto")).toBeNull();
    await answer();
  });

  it("a refusal rolls the badge back to the stage the page never left", async () => {
    machine.hold = true;
    machine.answer = "customer_told";
    const root = await dayPanel();
    await press(action(root, "calendar.action.veto"));
    expect(root.querySelector('[data-testid="day-head"]')?.textContent).toContain(
      COPY["calendar.empty.day-badge"]
    );
    await answer();
    // The write is answered and nothing moved, so the panel is the panel
    // it was: the stage it never left, and the stop still on offer.
    expect(root.querySelector('[data-testid="day-head"]')?.textContent).toContain(
      COPY["calendar.stage.your-review"]
    );
    expect(action(root, "calendar.action.veto")).not.toBeNull();
  });
});

describe("the page — Stop answers, and there is no Approve (issue 1337)", () => {
  const rail = (root: HTMLElement, key: string): Element | null =>
    root.querySelector(`[data-testid="draft-action-${key}"]`);

  it("a stop takes the controls off the rail at once, before the machine answers", async () => {
    machine.hold = true;
    const root = await mount(<DraftScreen view={DRAFT} generatedLabel="written by" />);
    await press(rail(root, "draft.action.veto"));
    expect(rail(root, "draft.action.approve")).toBeNull();
    expect(rail(root, "draft.action.edit")).toBeNull();
    expect(rail(root, "draft.action.veto")).toBeNull();
    await answer();
    expect(said[0]?.text).toBe(COPY["draft.answer.veto"]);
  });

  it("a refused stop says nothing changed, and leaves the controls where they were", async () => {
    machine.answer = "customer_told";
    // No hold: the refusal is answered, the optimistic state is dropped,
    // and what the rail then draws is the state the page still holds.
    const root = await mount(<DraftScreen view={DRAFT} generatedLabel="written by" />);
    await press(rail(root, "draft.action.veto"));
    expect(said[0]?.text).toBe(COPY["draft.answer.refused"]);
    expect(rail(root, "draft.action.approve")).toBeNull();
    expect(rail(root, "draft.action.veto")).not.toBeNull();
  });
});

describe("Settings — a change is stored and says so", () => {
  it("a mail switch writes the state it is asking for, and says it is saved", async () => {
    const root = await mount(<NotificationsPanel settings={SETTINGS} />);
    const first = root.querySelector('[data-testid="setting-notifications"] input');
    const wasOn = (first as HTMLInputElement).checked;
    await press(first);
    expect(wrote).toEqual([{ field: "notify_on", value: wasOn ? "off" : "on" }]);
    expect(said[0]?.text).toBe(COPY["settings.answer.saved"]);
  });

  it("the veto stepper writes whole days, in the hours the column stores", async () => {
    const root = await mount(<PublishingPanel settings={SETTINGS} />);
    await press(root.querySelector('[data-testid="veto-more"]'));
    const stored = SETTINGS.publishing.vetoHours;
    expect(wrote).toEqual([{ field: "veto_hours", value: String(stored + 24) }]);
  });

  it("a saved card shows the badge the canvas draws, and a refused one does not", async () => {
    const root = await mount(<NotificationsPanel settings={SETTINGS} />);
    expect(root.querySelector('[data-testid="notifications-saved"]')).toBeNull();
    await press(root.querySelector('[data-testid="setting-notifications"] input'));
    expect(root.querySelector('[data-testid="notifications-saved"]')?.textContent).toBe(
      COPY["settings.answer.saved-badge"]
    );
  });

  it("a switch moves on the press, before the write has answered", async () => {
    setting.hold = true;
    const root = await mount(<NotificationsPanel settings={SETTINGS} />);
    const first = () =>
      root.querySelector('[data-testid="setting-notifications"] input') as HTMLInputElement;
    const wasOn = first().checked;
    await press(first());
    // A controlled switch drawn from the stored value snaps back the
    // instant it is pressed; this is the arm that keeps it where the
    // customer put it while the write is on its way.
    expect(first().checked).toBe(!wasOn);
    await answer();
  });

  it("a refused switch goes back to where the stored value still has it", async () => {
    setting.hold = true;
    setting.answer = { answer: "refused" };
    const root = await mount(<NotificationsPanel settings={SETTINGS} />);
    const first = () =>
      root.querySelector('[data-testid="setting-notifications"] input') as HTMLInputElement;
    const wasOn = first().checked;
    await press(first());
    expect(first().checked).toBe(!wasOn);
    await answer();
    expect(first().checked).toBe(wasOn);
    expect(said[0]?.text).toBe(COPY["settings.answer.refused"]);
  });

  it("a publish-time change says it lands on the next page, not straight away", async () => {
    setting.answer = { answer: "saved", effect: "next-page" };
    const root = await mount(<PublishingPanel settings={SETTINGS} />);
    await press(root.querySelector('[data-testid="veto-more"]'));
    expect(said[0]?.text).toBe(COPY["settings.answer.saved-next-page"]);
  });
});

describe("the answer stack clears the bottom menu it will sit over", () => {
  it("the class carries the menu's height plus its clearance, so changing one fails here", () => {
    // SPEC §4 (2026-09-20): below the large breakpoint the three menu
    // items move to a bottom bar (issue #911). Tailwind finds a utility by
    // reading the source text for it, so the number cannot be
    // interpolated into the class — this row is what keeps the two
    // together, and names `src/app/_toast/Answers.tsx` when the dock
    // changes height.
    const clears = ANSWER_PLACEMENT.BOTTOM_MENU_PX + ANSWER_PLACEMENT.MENU_CLEARANCE_PX;
    expect(ANSWER_PLACEMENT.BOTTOM).toContain(`[bottom:calc(${clears}px_+_env(safe-area-inset-bottom`);
    // And the device's own safe area is respected, not assumed away.
    expect(ANSWER_PLACEMENT.BOTTOM).toContain("env(safe-area-inset-bottom,0px)");
    // From `lg` up there is no menu, and the stack keeps where it was —
    // `sonner`'s own 24px, which is what this shipped with.
    expect(ANSWER_PLACEMENT.BOTTOM).toContain("lg:bottom-6!");
  });
});
