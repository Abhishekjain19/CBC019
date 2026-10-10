import { NextResponse } from "next/server";
import { db } from "@/db";
import { place } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generatePlacesForDestinationWithAI } from "@/lib/gemini";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const destination = url.searchParams.get("destination");
    const category = url.searchParams.get("category");
    const query = url.searchParams.get("q");

    let placesList: any[] = [];
    try {
      if (destination) {
        placesList = await db.select().from(place).where(eq(place.destination, destination));

        // If no places found in DB for this destination, dynamically generate AI places for user location
        if (placesList.length === 0) {
          const aiGeneratedPlaces = await generatePlacesForDestinationWithAI(destination);

          // Save to database so future requests hit DB
          for (const p of aiGeneratedPlaces) {
            try {
              await db
                .insert(place)
                .values({
                  id: p.id,
                  destination,
                  name: p.name,
                  category: p.category,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  openingHours: p.openingHours,
                  hoursConfidence: p.hoursConfidence,
                  description: p.description,
                  popularityScore: p.popularityScore,
                  verified: false,
                })
                .onConflictDoNothing();
            } catch {}
          }

          placesList = aiGeneratedPlaces.map((p) => ({
            ...p,
            destination,
          }));
        }
      } else {
        placesList = await db.select().from(place);
      }
    } catch {
      // Fallback AI generation if DB connection issue occurs
      if (destination) {
        const aiGeneratedPlaces = await generatePlacesForDestinationWithAI(destination);
        placesList = aiGeneratedPlaces.map((p) => ({ ...p, destination }));
      }
    }

    if (category && category !== "all") {
      placesList = placesList.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (query) {
      const q = query.toLowerCase();
      placesList = placesList.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ places: placesList });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch places" }, { status: 500 });
  }
}

