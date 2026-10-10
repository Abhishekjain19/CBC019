import { NextResponse } from "next/server";
import { db } from "@/db";
import { trip, tripMember } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { code, userId = "user-joined" } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Join code is required." }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    if (cleanCode.length !== 8) {
      return NextResponse.json({ error: "Join code must be exactly 8 characters." }, { status: 400 });
    }

    // Query Neon database for matching joinCode
    const rows = await db.select().from(trip).where(eq(trip.joinCode, cleanCode));
    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired join code. Check with your trip host." }, { status: 404 });
    }

    const foundTrip = rows[0];

    // Add to tripMember if not already there
    try {
      await db.insert(tripMember).values({
        tripId: foundTrip.id,
        userId,
        role: "member",
      }).onConflictDoNothing();
    } catch {
      // Already a member — no-op
    }

    return NextResponse.json({ success: true, tripId: foundTrip.id, trip: foundTrip });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process join code" }, { status: 500 });
  }
}
