import { NextResponse } from "next/server";
import { db } from "@/db";
import { trip, tripMember, itinerary, stop, place, expense, profile } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find trip in DB: try direct UUID match, or joinCode match
    let tripRecord: any = null;

    try {
      // 1. Direct ID match
      const directMatches = await db.select().from(trip).where(eq(trip.id, id as any));
      if (directMatches.length > 0) {
        tripRecord = directMatches[0];
      }
    } catch {}

    if (!tripRecord) {
      try {
        // 2. Join code match
        const codeMatches = await db.select().from(trip).where(eq(trip.joinCode, id.toUpperCase()));
        if (codeMatches.length > 0) {
          tripRecord = codeMatches[0];
        }
      } catch {}
    }

    if (!tripRecord) {
      return NextResponse.json({ error: "Trip not found. The link may be invalid or the trip may have been deleted." }, { status: 404 });
    }

    // Fetch related records from DB
    // 1. Itinerary
    let itins = await db.select().from(itinerary).where(eq(itinerary.tripId, tripRecord.id));
    let itinRecord = itins[0];
    if (!itinRecord) {
      const [newItin] = await db
        .insert(itinerary)
        .values({
          tripId: tripRecord.id,
          status: "confirmed",
          version: 1,
        })
        .returning();
      itinRecord = newItin;
    }

    // 2. Stops
    let dbStops: any[] = [];
    if (itinRecord) {
      dbStops = await db.select().from(stop).where(eq(stop.itineraryId, itinRecord.id));
    }

    // 3. Destination Places from DB
    const destPlaces = await db
      .select()
      .from(place)
      .where(eq(place.destination, tripRecord.destination));

    // Map place names & categories to stops
    const mappedStops = dbStops.map((s) => {
      const matchedPlace = destPlaces.find((p) => p.id === s.placeId);
      return {
        id: s.id,
        placeId: s.placeId,
        placeName: matchedPlace?.name || s.placeId,
        category: matchedPlace?.category || "attraction",
        dayIndex: s.dayIndex,
        startTime: s.startTime,
        endTime: s.endTime,
        sortOrder: s.sortOrder,
        estCostPaise: s.estCostPaise || 0,
        notes: s.notes || matchedPlace?.description || "",
      };
    });

    // 4. Members from DB
    const dbMembers = await db
      .select()
      .from(tripMember)
      .where(eq(tripMember.tripId, tripRecord.id));

    const allProfiles = await db.select().from(profile).catch(() => []);
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p.displayName]));

    const mappedMembers = dbMembers.map((m) => ({
      userId: m.userId,
      displayName:
        profileMap.get(m.userId) ||
        (m.userId === tripRecord.ownerId
          ? "Trip Host (You)"
          : m.userId.replace("user-", "").replace(/^\w/, (c) => c.toUpperCase()) || "Traveller"),
      email: `${m.userId.replace("user-", "")}@voyara.travel`,
      role: m.role as "owner" | "member",
    }));

    // 5. Expenses from DB
    const dbExpenses = await db
      .select()
      .from(expense)
      .where(eq(expense.tripId, tripRecord.id))
      .orderBy(desc(expense.createdAt));

    const mappedExpenses = dbExpenses.map((e) => {
      const payer = mappedMembers.find((m) => m.userId === e.payerId);
      return {
        id: e.id,
        payerId: e.payerId,
        payerName: payer?.displayName || e.payerId,
        amountPaise: e.amountPaise,
        category: e.category,
        note: e.note || "Expense",
        spentAt: e.spentAt ? new Date(e.spentAt).toISOString() : new Date().toISOString(),
        splitType: e.splitType,
      };
    });

    return NextResponse.json({
      success: true,
      trip: {
        id: tripRecord.id,
        name: tripRecord.name || `${tripRecord.destination} Journey`,
        destination: tripRecord.destination,
        type: tripRecord.type,
        peopleCount: Math.max(mappedMembers.length, tripRecord.peopleCount || 1),
        startDate: tripRecord.startDate,
        endDate: tripRecord.endDate,
        dailyStart: tripRecord.dailyStart || "09:00",
        dailyEnd: tripRecord.dailyEnd || "21:00",
        transportMode: tripRecord.transportMode || "driving",
        budgetPaise: tripRecord.budgetPaise || 0,
        status: tripRecord.status,
        joinCode: tripRecord.joinCode,
        version: tripRecord.version,
      },
      members: mappedMembers,
      itinerary: itinRecord,
      stops: mappedStops,
      places: destPlaces,
      expenses: mappedExpenses,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load trip from database" }, { status: 500 });
  }
}
