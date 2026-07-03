/**
 * /app/onboarding — superseded by the app-wide SetupOverlay (rendered from the
 * app layout whenever setup is incomplete). Old links land on /app, where the
 * overlay takes over automatically for anyone who still needs onboarding.
 * The `saveOnboarding` server action + form parsing live on in ./actions.ts.
 */
import { redirect } from "next/navigation";

export default function OnboardingPage() {
  redirect("/app");
}
