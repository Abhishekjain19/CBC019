import type { Metadata } from "next";
import OnboardingClient from "./onboarding-client";

export const metadata: Metadata = {
  title: "Traveler Preferences — Voyara",
  description: "Set your travel style, vibe tags, pace, and budget preferences.",
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
