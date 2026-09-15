// The owner-facing mail occasion (issue #329) — §6.5's ceilings, §11's switch.
export {
  installSpendAlerts,
  reportKillSwitchEngaged,
  sendOpsAlert,
} from "./spend-ceiling";
// The owner's incident alert (issue 330) — a job failed or was dead-lettered,
// or a deployment refused to boot.
export { errorNameOf, reportIncident } from "./incident";
