import type { Metadata } from "next";
import TripWorkspaceClient from "./trip-workspace-client";

export const metadata: Metadata = {
  title: "Trip Workspace — Voyara",
  description: "Itinerary builder, place discovery, conflict detector, and shared group expense splits.",
};

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TripWorkspaceClient tripId={id} />;
}
