import { db } from "@/db";
import { trip, tripMember } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function resolveTripRecord(idOrSlug: string, userId?: string) {
  if (!idOrSlug) return null;

  let foundTrip: any = null;
  let matchedByCode = false;

  // 1. Direct ID match
  try {
    const directMatches = await db.select().from(trip).where(eq(trip.id, idOrSlug as any));
    if (directMatches.length > 0) foundTrip = directMatches[0];
  } catch {}

  // 2. Join code match
  if (!foundTrip) {
    try {
      const codeMatches = await db.select().from(trip).where(eq(trip.joinCode, idOrSlug.toUpperCase()));
      if (codeMatches.length > 0) {
        foundTrip = codeMatches[0];
        matchedByCode = true;
      }
    } catch {}
  }

  if (!foundTrip) return null;

  // If userId is provided, verify ownership or membership
  if (userId) {
    if (foundTrip.ownerId === userId) return foundTrip;

    const memberMatch = await db
      .select()
      .from(tripMember)
      .where(and(eq(tripMember.tripId, foundTrip.id), eq(tripMember.userId, userId)));

    if (memberMatch.length > 0) return foundTrip;

    // If matched by valid join code, auto-enroll authenticated user as member
    if (matchedByCode) {
      try {
        await db
          .insert(tripMember)
          .values({
            tripId: foundTrip.id,
            userId,
            role: "member",
          })
          .onConflictDoNothing();
        return foundTrip;
      } catch {}
    }

    // User is neither owner nor member
    return null;
  }

  return foundTrip;
}


