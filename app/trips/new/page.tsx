import type { Metadata } from "next";
import CreateTripClient from "./create-trip-client";

export const metadata: Metadata = {
  title: "Create Trip — Voyara",
  description: "Plan a new solo, family, or friend-group journey with AI and shared expense tracking.",
};

export default function NewTripPage() {
  return <CreateTripClient />;
}
