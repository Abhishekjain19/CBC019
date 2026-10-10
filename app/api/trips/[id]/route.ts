import { NextResponse } from "next/server";
import { db } from "@/db";
import { trip, tripMember, itinerary, stop, place, expense, profile, userAuth } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { resolveTripRecord } from "@/lib/trips-db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tripRecord = await resolveTripRecord(id, user.userId);
    if (!tripRecord) {
      return NextResponse.json({ error: "Trip not found or unauthorized access" }, { status: 404 });
    }

    const body = await req.json();
    const { status } = body;

    const allowedStatuses = ["planning", "confirmed", "live", "completed", "archived"];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(trip)
      .set({ status, updatedAt: new Date() })
      .where(eq(trip.id, tripRecord.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update trip status" }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tripRecord = await resolveTripRecord(id, user.userId);

    if (!tripRecord) {
      return NextResponse.json(
        { error: "Trip not found. The link may be invalid, or you do not have permission to view this trip." },
        { status: 404 }
      );
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

    const allAuthUsers = await db
      .select({ id: userAuth.id, displayName: userAuth.displayName, email: userAuth.email })
      .from(userAuth)
      .catch(() => []);
    const authMap = new Map(allAuthUsers.map((a) => [a.id, a]));

    const allProfiles = await db.select().from(profile).catch(() => []);
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p.displayName]));

    let memberList = [...dbMembers];
    if (!memberList.some((m) => m.userId === tripRecord.ownerId)) {
      memberList.unshift({
        tripId: tripRecord.id,
        userId: tripRecord.ownerId,
        role: "owner",
        joinedAt: new Date(),
        removedAt: null,
      });
    }

    const mappedMembers = memberList.map((m) => {
      const authUser = authMap.get(m.userId);
      const profileName = profileMap.get(m.userId);
      const isCurrentLogin = m.userId === user.userId;
      const isOwner = m.userId === tripRecord.ownerId || m.role === "owner";

      let displayName = authUser?.displayName || profileName;
      if (!displayName && isCurrentLogin && user.displayName) {
        displayName = user.displayName;
      }
      if (!displayName) {
        displayName = isOwner ? "Trip Host" : "Co-Traveller";
      }

      const email = authUser?.email || (isCurrentLogin ? user.email : `${m.userId}@voyara.travel`);

      return {
        userId: m.userId,
        displayName,
        email,
        role: (isOwner ? "owner" : "member") as "owner" | "member",
      };
    });

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
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
      },
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

