import { NextResponse } from "next/server";
import { generateItineraryWithGemini, PlaceSummary } from "@/lib/gemini";
import { db } from "@/db";
import { place } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { destination, tripType = "group", daysCount = 3, dailyStart = "09:00", dailyEnd = "21:00" } = body;

    if (!destination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    let availablePlaces: PlaceSummary[] = [];
    try {
      const records = await db.select().from(place).where(eq(place.destination, destination));
      availablePlaces = records.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        openingHours: p.openingHours,
      }));
    } catch {
      // fallback if DB connection offline
    }

    if (availablePlaces.length === 0) {
      availablePlaces = [
        { id: "dest-1", name: `${destination} Landmark`, category: "heritage", openingHours: "09:00-18:00", estCostPaise: 50000 },
        { id: "dest-2", name: `${destination} Coastline`, category: "beach", openingHours: "06:00-20:00", estCostPaise: 20000 },
        { id: "dest-3", name: `${destination} Sanctuary`, category: "nature", openingHours: "08:00-17:00", estCostPaise: 40000 },
      ];
    }

    const itineraryDays = await generateItineraryWithGemini(
      destination,
      tripType,
      daysCount,
      availablePlaces,
      dailyStart,
      dailyEnd
    );

    return NextResponse.json({
      destination,
      tripType,
      daysCount,
      itinerary: itineraryDays,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate itinerary" }, { status: 500 });
  }
}
