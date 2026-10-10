import { NextResponse } from "next/server";
import { generateItineraryWithGemini, PlaceSummary, generatePlacesForDestinationWithAI } from "@/lib/gemini";
import { db } from "@/db";
import { place, stop, itinerary, trip, profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    const body = await req.json();
    const {
      tripId,
      destination,
      tripType = "group",
      daysCount = 3,
      dailyStart = "09:00",
      dailyEnd = "21:00",
      forceRegenerate = false,
      userVibes = [],
    } = body;

    let targetDestination = destination;
    let tripRecord: any = null;

    // 1. Fetch trip record if tripId provided
    if (tripId) {
      try {
        const directMatches = await db.select().from(trip).where(eq(trip.id, tripId as any));
        if (directMatches.length > 0) {
          tripRecord = directMatches[0];
          targetDestination = tripRecord.destination || destination;
        }
      } catch {}

      // If NOT forced to regenerate, check if DB already has stored itinerary stops
      if (tripRecord && !forceRegenerate) {
        const existingItins = await db.select().from(itinerary).where(eq(itinerary.tripId, tripRecord.id));
        if (existingItins.length > 0) {
          const itinId = existingItins[0].id;
          const existingStops = await db.select().from(stop).where(eq(stop.itineraryId, itinId));

          if (existingStops.length > 0) {
            const destPlaces = await db
              .select()
              .from(place)
              .where(eq(place.destination, targetDestination));

            const daysMap = new Map<number, any[]>();
            existingStops.forEach((s) => {
              const matchedPlace = destPlaces.find((p) => p.id === s.placeId);
              const dayList = daysMap.get(s.dayIndex) || [];
              dayList.push({
                placeId: s.placeId,
                placeName: matchedPlace?.name || s.placeId,
                category: matchedPlace?.category || "attraction",
                startTime: s.startTime,
                endTime: s.endTime,
                estCostPaise: s.estCostPaise || 0,
                notes: s.notes || matchedPlace?.description || "",
              });
              daysMap.set(s.dayIndex, dayList);
            });

            const cachedItineraryDays = Array.from(daysMap.entries()).map(([dayIdx, stopsList]) => ({
              dayIndex: dayIdx,
              title: `${targetDestination} Day ${dayIdx}: Highlights`,
              stops: stopsList.sort((a, b) => a.startTime.localeCompare(b.startTime)),
            }));

            return NextResponse.json({
              destination: targetDestination,
              tripType: tripRecord.type || tripType,
              daysCount: cachedItineraryDays.length,
              itinerary: cachedItineraryDays,
              cached: true,
              message: "Retrieved saved itinerary from database.",
            });
          }
        }
      }
    }

    if (!targetDestination) {
      return NextResponse.json({ error: "Destination is required" }, { status: 400 });
    }

    // 2. Fetch or generate available places for destination from DB
    let availablePlacesList: PlaceSummary[] = [];
    try {
      const records = await db.select().from(place).where(eq(place.destination, targetDestination));
      if (records.length > 0) {
        availablePlacesList = records.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          openingHours: p.openingHours,
          estCostPaise: 40000,
        }));
      } else {
        const aiPlaces = await generatePlacesForDestinationWithAI(targetDestination);
        for (const p of aiPlaces) {
          try {
            await db
              .insert(place)
              .values({
                id: p.id,
                destination: targetDestination,
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
        availablePlacesList = aiPlaces.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          openingHours: p.openingHours,
          estCostPaise: 40000,
        }));
      }
    } catch {
      availablePlacesList = [
        { id: `${targetDestination.toLowerCase()}-1`, name: `${targetDestination} Landmark`, category: "heritage", openingHours: "09:00-18:00", estCostPaise: 40000 },
        { id: `${targetDestination.toLowerCase()}-2`, name: `${targetDestination} Promenade`, category: "attraction", openingHours: "06:00-20:00", estCostPaise: 20000 },
        { id: `${targetDestination.toLowerCase()}-3`, name: `${targetDestination} Nature Reserve`, category: "nature", openingHours: "08:00-17:00", estCostPaise: 30000 },
      ];
    }

    // 3. User travel preferences/vibes
    let effectiveVibes: string[] = userVibes;
    if (user && effectiveVibes.length === 0) {
      try {
        const profs = await db.select().from(profile).where(eq(profile.userId, user.userId));
        if (profs.length > 0 && profs[0].vibeTags) {
          effectiveVibes = JSON.parse(profs[0].vibeTags);
        }
      } catch {}
    }

    // 4. Generate AI itinerary
    let calculatedDaysCount = Number(daysCount) || 3;
    if (tripRecord && tripRecord.startDate && tripRecord.endDate) {
      try {
        const startMs = new Date(tripRecord.startDate).getTime();
        const endMs = new Date(tripRecord.endDate).getTime();
        if (!isNaN(startMs) && !isNaN(endMs)) {
          const diffDays = Math.ceil(Math.abs(endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
          if (!isNaN(diffDays) && diffDays > 0) {
            calculatedDaysCount = Math.max(1, Math.min(14, diffDays));
          }
        }
      } catch {}
    }

    let itineraryDays = await generateItineraryWithGemini(
      targetDestination,
      tripRecord?.type || tripType,
      calculatedDaysCount || 3,
      availablePlacesList,
      dailyStart,
      dailyEnd
    );

    // 5. Budget Evaluation & Travel Vibe Preference Scoring
    const budgetPaise = tripRecord?.budgetPaise || 0;
    let totalEstCostPaise = 0;
    itineraryDays.forEach((d) => {
      d.stops.forEach((s) => {
        totalEstCostPaise += s.estCostPaise || 40000;
      });
    });

    let budgetExceeded = false;
    let budgetMessage = "";
    let retainedStopsCount = itineraryDays.reduce((sum, d) => sum + d.stops.length, 0);
    const originalStopsCount = retainedStopsCount;

    if (budgetPaise > 0 && totalEstCostPaise > budgetPaise) {
      budgetExceeded = true;

      // Flatten all stops across all days and score by vibe match
      const allStopsFlat: Array<{ stop: any; dayIndex: number; vibeScore: number }> = [];
      itineraryDays.forEach((day) => {
        day.stops.forEach((s) => {
          const placeRecord = availablePlacesList.find((p) => p.id === s.placeId);
          const vibeScore = effectiveVibes.reduce((score, vibe) => {
            const cat = (placeRecord?.category || (s as any).category || "").toLowerCase();
            const viveLower = vibe.toLowerCase();
            if (cat.includes(viveLower) || viveLower.includes(cat)) return score + 2;
            return score;
          }, 0);
          allStopsFlat.push({ stop: s, dayIndex: day.dayIndex, vibeScore });
        });
      });

      // Sort all stops by vibe score descending (keep best matches first)
      allStopsFlat.sort((a, b) => b.vibeScore - a.vibeScore);

      // Greedily pick stops until budget would be exceeded
      let runningCost = 0;
      const keptStopIdsByDay = new Map<number, Set<string>>();
      const dayStopCounts = new Map<number, number>();
      
      // Ensure at least 1 stop per day
      const dayIndices = [...new Set(allStopsFlat.map((s) => s.dayIndex))];
      dayIndices.forEach((d) => {
        const firstStopForDay = allStopsFlat.find((s) => s.dayIndex === d);
        if (firstStopForDay) {
          const cost = firstStopForDay.stop.estCostPaise || 40000;
          runningCost += cost;
          if (!keptStopIdsByDay.has(d)) keptStopIdsByDay.set(d, new Set());
          keptStopIdsByDay.get(d)!.add(firstStopForDay.stop.placeId);
          dayStopCounts.set(d, (dayStopCounts.get(d) || 0) + 1);
        }
      });

      // Fill remaining budget with vibe-sorted stops
      for (const { stop: s, dayIndex } of allStopsFlat) {
        const alreadyKept = keptStopIdsByDay.get(dayIndex)?.has(s.placeId);
        if (alreadyKept) continue;
        const cost = s.estCostPaise || 40000;
        if (runningCost + cost <= budgetPaise) {
          runningCost += cost;
          if (!keptStopIdsByDay.has(dayIndex)) keptStopIdsByDay.set(dayIndex, new Set());
          keptStopIdsByDay.get(dayIndex)!.add(s.placeId);
        }
      }

      // Rebuild itinerary days with only kept stops, maintaining time ordering
      itineraryDays = itineraryDays.map((day) => ({
        ...day,
        stops: day.stops.filter((s) => keptStopIdsByDay.get(day.dayIndex)?.has(s.placeId)),
      }));

      retainedStopsCount = itineraryDays.reduce((sum, d) => sum + d.stops.length, 0);

      budgetMessage = `Estimated itinerary cost (₹${(totalEstCostPaise / 100).toLocaleString(
        "en-IN"
      )}) exceeds your allocated budget of ₹${(budgetPaise / 100).toLocaleString(
        "en-IN"
      )}. We retained ${retainedStopsCount} of ${originalStopsCount} stops prioritizing places that best match your travel vibes (${effectiveVibes.join(", ") || tripRecord?.type || "highlights"}). Increase your budget to restore all stops.`;
    }

    // 6. Persist generated itinerary & stops to database if tripRecord exists
    if (tripRecord) {
      try {
        let itins = await db.select().from(itinerary).where(eq(itinerary.tripId, tripRecord.id));
        let itinId = itins[0]?.id;
        if (!itinId) {
          const [newItin] = await db
            .insert(itinerary)
            .values({ tripId: tripRecord.id, status: "confirmed", version: 1 })
            .returning();
          itinId = newItin.id;
        }

        // Wipe old stops to replace with fresh AI itinerary
        await db.delete(stop).where(eq(stop.itineraryId, itinId));

        // Insert new AI stops
        for (const dayObj of itineraryDays) {
          let sortOrder = 1;
          for (const s of dayObj.stops) {
            // Ensure place exists in place table to satisfy foreign key requirement
            const placeId = s.placeId || `place-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
            const existingPlace = await db.select().from(place).where(eq(place.id, placeId));
            if (existingPlace.length === 0) {
              await db
                .insert(place)
                .values({
                  id: placeId,
                  destination: targetDestination,
                  name: s.placeName || (s as any).name || placeId,
                  category: (s as any).category || "attraction",
                  latitude: "15.2993",
                  longitude: "74.1240",
                  openingHours: (s as any).openingHours || "09:00 - 21:00",
                  hoursConfidence: "AI Generated",
                  description: s.notes || "AI Recommended Place",
                  popularityScore: 85,
                  verified: false,
                })
                .onConflictDoNothing();
            }

            await db.insert(stop).values({
              itineraryId: itinId,
              placeId,
              dayIndex: dayObj.dayIndex,
              startTime: s.startTime,
              endTime: s.endTime,
              sortOrder: sortOrder++,
              estCostPaise: s.estCostPaise || 40000,
              notes: s.notes || "AI Smart Itinerary stop",
            });
          }
        }
      } catch (saveErr) {
        console.warn("Failed to persist AI stops to database:", saveErr);
      }
    }

    return NextResponse.json({
      destination: targetDestination,
      tripType: tripRecord?.type || tripType,
      daysCount: itineraryDays.length,
      itinerary: itineraryDays,
      cached: false,
      budgetExceeded,
      totalEstCostPaise,
      budgetPaise,
      budgetMessage,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate AI itinerary" }, { status: 500 });
  }
}


