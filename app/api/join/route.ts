import { NextResponse } from "next/server";
import { db } from "@/db";
import { trip, tripMember } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Please sign in to join this trip.", requiresAuth: true },
        { status: 401 }
      );
    }

    const { code } = await req.json();

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

    // Add authenticated user to tripMember if not owner
    if (foundTrip.ownerId !== user.userId) {
      try {
        await db
          .insert(tripMember)
          .values({
            tripId: foundTrip.id,
            userId: user.userId,
            role: "member",
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Error inserting trip member:", err);
      }
    }

    return NextResponse.json({ success: true, tripId: foundTrip.id, trip: foundTrip });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process join code" }, { status: 500 });
  }
}

