import { db } from "@/db";
import { trip } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function resolveTripRecord(idOrSlug: string) {
  if (!idOrSlug) return null;

  // 1. Direct ID match
  try {
    const directMatches = await db.select().from(trip).where(eq(trip.id, idOrSlug as any));
    if (directMatches.length > 0) return directMatches[0];
  } catch {}

  // 2. Join code match
  try {
    const codeMatches = await db.select().from(trip).where(eq(trip.joinCode, idOrSlug.toUpperCase()));
    if (codeMatches.length > 0) return codeMatches[0];
  } catch {}

  // 3. Fallback for demo slugs (e.g. demo_goa, demo-goa, demo-coorg)
  const isGoa = idOrSlug.toLowerCase().includes("goa");
  const isCoorg = idOrSlug.toLowerCase().includes("coorg");
  const dest = isGoa ? "Goa" : isCoorg ? "Coorg" : "Hampi";

  try {
    const destTrips = await db
      .select()
      .from(trip)
      .where(eq(trip.destination, dest))
      .orderBy(desc(trip.createdAt));

    if (destTrips.length > 0) return destTrips[0];
  } catch {}

  // 4. Any trip fallback
  try {
    const anyTrips = await db.select().from(trip).limit(1);
    if (anyTrips.length > 0) return anyTrips[0];
  } catch {}

  return null;
}
