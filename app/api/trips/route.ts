import { NextResponse } from "next/server";
import { db } from "@/db";
import { trip, tripMember, itinerary, stop, expense, place } from "@/db/schema";
import { eq, desc, or, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import crypto from "crypto";

function generateJoinCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 8; i++) {
    const idx = crypto.randomInt(0, chars.length);
    result += chars[idx];
  }
  return result;
}

const DESTINATION_IMAGES: Record<string, string> = {
  Goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
  Coorg: "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=600&q=80",
  Hampi: "https://images.unsplash.com/photo-1600100397608-f010f4448555?auto=format&fit=crop&w=600&q=80",
  Default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80",
};

export async function GET(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find member trip IDs for this user
    const memberRecords = await db
      .select({ tripId: tripMember.tripId })
      .from(tripMember)
      .where(eq(tripMember.userId, user.userId));

    const memberTripIds = memberRecords.map((m) => m.tripId);

    // Fetch user owned or member trips
    let userTrips: any[] = [];
    if (memberTripIds.length > 0) {
      userTrips = await db
        .select()
        .from(trip)
        .where(or(eq(trip.ownerId, user.userId), inArray(trip.id, memberTripIds)))
        .orderBy(desc(trip.createdAt));
    } else {
      userTrips = await db
        .select()
        .from(trip)
        .where(eq(trip.ownerId, user.userId))
        .orderBy(desc(trip.createdAt));
    }

    // Deduplicate trips by ID
    const uniqueTripsMap = new Map<string, any>();
    userTrips.forEach((t) => {
      if (t.id && !uniqueTripsMap.has(t.id)) {
        uniqueTripsMap.set(t.id, t);
      }
    });
    const uniqueUserTrips = Array.from(uniqueTripsMap.values());

    const allMembers = await db.select().from(tripMember);
    const allItins = await db.select().from(itinerary);
    const allStops = await db.select().from(stop);
    const allExpenses = await db.select().from(expense);
    const allPlaces = await db.select().from(place);

    // Map counts per trip
    const tripsWithStats = uniqueUserTrips.map((t) => {
      const membersForTrip = allMembers.filter((m) => m.tripId === t.id && !m.removedAt);
      const itin = allItins.find((i) => i.tripId === t.id);
      const stopsForTrip = itin ? allStops.filter((s) => s.itineraryId === itin.id) : [];

      // Compute days count
      let daysCount = 3;
      try {
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (!isNaN(diffDays) && diffDays > 0) daysCount = diffDays;
      } catch {}

      const destImage = DESTINATION_IMAGES[t.destination] || DESTINATION_IMAGES.Default;

      return {
        id: t.id,
        name: (t as any).name || `${t.destination} ${t.type === "group" ? "Getaway" : "Journey"}`,
        destination: `${t.destination}, India`,
        startDate: t.startDate,
        endDate: t.endDate,
        dates: `${t.startDate} – ${t.endDate}`,
        type: t.type === "group" ? "Friends Group" : t.type === "family" ? "Family Retreat" : "Solo Expedition",
        members: Math.max(membersForTrip.length, t.peopleCount || 1),
        status: t.status as "planning" | "confirmed" | "live" | "completed",
        image: destImage,
        budget: `₹${((t.budgetPaise || 0) / 100).toLocaleString("en-IN")}`,
        budgetPaise: t.budgetPaise || 0,
        days: daysCount,
        stopsCount: stopsForTrip.length,
        joinCode: t.joinCode,
        createdAt: t.createdAt,
      };
    });

    // Compute metrics specifically for user's trips
    const totalBudgetPaise = userTrips.reduce((acc, t) => acc + (t.budgetPaise || 0), 0);
    const userTripIds = new Set(userTrips.map((t) => t.id));
    const userTripMembers = allMembers.filter((m) => userTripIds.has(m.tripId));
    const uniqueTravellers = new Set(userTripMembers.map((m) => m.userId)).size;
    const totalStopsCount = tripsWithStats.reduce((acc, t) => acc + t.stopsCount, 0);

    const metrics = [
      {
        label: "Active Trips",
        value: String(userTrips.length),
        sub: "user trips",
        icon: "TrendingUp",
      },
      {
        label: "Travellers",
        value: String(Math.max(uniqueTravellers, userTrips.reduce((acc, t) => acc + (t.peopleCount || 1), 0))),
        sub: "members",
        icon: "Users",
      },
      {
        label: "Curated Stops",
        value: String(totalStopsCount),
        sub: "planned",
        icon: "Compass",
      },
      {
        label: "Combined Budget",
        value: `₹${(totalBudgetPaise / 100).toLocaleString("en-IN")}`,
        sub: "allocated",
        icon: "Wallet",
        accent: true,
      },
    ];

    return NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
      },
      trips: tripsWithStats,
      metrics,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch trips" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      destination,
      type = "group",
      peopleCount = 1,
      startDate,
      endDate,
      dailyStart = "09:00",
      dailyEnd = "21:00",
      transportMode = "driving",
      budgetPaise = 0,
    } = body;

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Destination, start date, and end date are required." },
        { status: 400 }
      );
    }

    const joinCode = generateJoinCode();

    const [newTrip] = await db
      .insert(trip)
      .values({
        ownerId: user.userId,
        type,
        peopleCount: Number(peopleCount) || 1,
        destination,
        startDate,
        endDate,
        dailyStart,
        dailyEnd,
        transportMode,
        budgetPaise: Number(budgetPaise) || 0,
        joinCode,
        status: "planning",
        version: 1,
      })
      .returning();

    // Register creator as owner member
    await db.insert(tripMember).values({
      tripId: newTrip.id,
      userId: user.userId,
      role: "owner",
    });

    // Create initial draft itinerary
    await db.insert(itinerary).values({
      tripId: newTrip.id,
      status: "draft",
      version: 1,
    });

    return NextResponse.json({ success: true, trip: newTrip });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create trip" }, { status: 500 });
  }
}

