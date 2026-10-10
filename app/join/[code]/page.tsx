import type { Metadata } from "next";
import JoinCodeClient from "./join-code-client";

export const metadata: Metadata = {
  title: "Join Trip — Voyara",
  description: "Join your friends' travel itinerary and shared expense ledger.",
};

export default async function JoinCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinCodeClient code={code} />;
}
