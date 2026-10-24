// The owner-facing mail occasions: §6.5's ceilings and §11's switch.
export {
  installSpendAlerts,
  reportKillSwitchEngaged,
  sendOpsAlert,
} from "./spend-ceiling";
// The owner's incident alert: a job failed or was dead-lettered, or a deploy refused to boot.
export { errorNameOf, reportIncident } from "./incident";
