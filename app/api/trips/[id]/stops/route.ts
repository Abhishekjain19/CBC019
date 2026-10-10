import { NextResponse } from "next/server";
import { db } from "@/db";
import { itinerary, stop, place } from "@/db/schema";
import { resolveTripRecord } from "@/lib/trips-db";
import { getSessionUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tripId } = await params;
    const tripRecord = await resolveTripRecord(tripId, user.userId);
    if (!tripRecord) {
      return NextResponse.json({ error: "Trip not found or unauthorized access" }, { status: 404 });
    }

    const body = await req.json();
    const {
      placeId,
      placeName = "Custom Spot",
      category = "sightseeing",
      dayIndex = 1,
      startTime = "10:00",
      endTime = "12:00",
      sortOrder = 1,
      estCostPaise = 0,
      notes = "",
    } = body;

    // 1. Get or create itinerary for this trip
    let itins = await db.select().from(itinerary).where(eq(itinerary.tripId, tripRecord.id));
    let itin = itins[0];
    if (!itin) {
      const [newItin] = await db
        .insert(itinerary)
        .values({
          tripId: tripRecord.id,
          status: "confirmed",
          version: 1,
        })
        .returning();
      itin = newItin;
    }

    // 2. Ensure place exists in `place` table to satisfy foreign key
    let finalPlaceId = placeId || `place-${Date.now()}`;
    const existingPlace = await db.select().from(place).where(eq(place.id, finalPlaceId));
    if (existingPlace.length === 0) {
      await db.insert(place).values({
        id: finalPlaceId,
        destination: tripRecord.destination,
        name: placeName,
        category,
        latitude: "15.2993",
        longitude: "74.1240",
        openingHours: "09:00 - 21:00",
        hoursConfidence: "Estimated",
        description: notes || placeName,
        popularityScore: 80,
        verified: false,
      });
    }

    // 3. Insert stop into DB
    const [newStop] = await db
      .insert(stop)
      .values({
        itineraryId: itin.id,
        placeId: finalPlaceId,
        dayIndex: Number(dayIndex) || 1,
        startTime,
        endTime,
        sortOrder: Number(sortOrder) || 1,
        estCostPaise: Number(estCostPaise) || 0,
        notes,
      })
      .returning();

    return NextResponse.json({
      success: true,
      stop: {
        id: newStop.id,
        placeId: newStop.placeId,
        placeName,
        category,
        dayIndex: newStop.dayIndex,
        startTime: newStop.startTime,
        endTime: newStop.endTime,
        sortOrder: newStop.sortOrder,
        estCostPaise: newStop.estCostPaise,
        notes: newStop.notes,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add stop" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tripId } = await params;
    const tripRecord = await resolveTripRecord(tripId, user.userId);
    if (!tripRecord) {
      return NextResponse.json({ error: "Trip not found or unauthorized access" }, { status: 404 });
    }

    const body = await req.json();
    const {
      stopId,
      dayIndex,
      startTime,
      endTime,
      sortOrder,
      estCostPaise,
      notes,
    } = body;

    if (!stopId) {
      return NextResponse.json({ error: "stopId is required" }, { status: 400 });
    }

    const updateFields: any = {};
    if (dayIndex !== undefined) updateFields.dayIndex = Number(dayIndex);
    if (startTime !== undefined) updateFields.startTime = startTime;
    if (endTime !== undefined) updateFields.endTime = endTime;
    if (sortOrder !== undefined) updateFields.sortOrder = Number(sortOrder);
    if (estCostPaise !== undefined) updateFields.estCostPaise = Number(estCostPaise);
    if (notes !== undefined) updateFields.notes = notes;

    const [updated] = await db
      .update(stop)
      .set(updateFields)
      .where(eq(stop.id, stopId))
      .returning();

    return NextResponse.json({ success: true, stop: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update stop" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tripId } = await params;
    const tripRecord = await resolveTripRecord(tripId, user.userId);
    if (!tripRecord) {
      return NextResponse.json({ error: "Trip not found or unauthorized access" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const stopId = searchParams.get("stopId");

    if (!stopId) {
      return NextResponse.json({ error: "stopId parameter required" }, { status: 400 });
    }

    await db.delete(stop).where(eq(stop.id, stopId as any));
    return NextResponse.json({ success: true, deletedId: stopId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete stop" }, { status: 500 });
  }
}

