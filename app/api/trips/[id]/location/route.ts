import { NextResponse } from "next/server";
import { db } from "@/db";
import { tripMember, userAuth, profile } from "@/db/schema";
import { resolveTripRecord } from "@/lib/trips-db";
import { getSessionUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// POST /api/trips/[id]/location — Broadcast user's live GPS location
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
    const { latitude, longitude } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "latitude and longitude are required" }, { status: 400 });
    }

    const latStr = String(latitude);
    const lngStr = String(longitude);

    // Update location in tripMember
    await db
      .update(tripMember)
      .set({
        latitude: latStr,
        longitude: lngStr,
        lastLocationAt: new Date(),
      })
      .where(and(eq(tripMember.tripId, tripRecord.id), eq(tripMember.userId, user.userId)));

    return NextResponse.json({ success: true, latitude: latStr, longitude: lngStr });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update location" }, { status: 500 });
  }
}

// GET /api/trips/[id]/location — Fetch live location of all party members
export async function GET(
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

    const dbMembers = await db
      .select()
      .from(tripMember)
      .where(eq(tripMember.tripId, tripRecord.id));

    const allAuth = await db
      .select({ id: userAuth.id, displayName: userAuth.displayName })
      .from(userAuth)
      .catch(() => []);
    const authMap = new Map(allAuth.map((a) => [a.id, a.displayName]));

    const allProfiles = await db.select().from(profile).catch(() => []);
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p.displayName]));

    const membersWithLocations = dbMembers.map((m) => {
      const isCurrentLogin = m.userId === user.userId;
      const isOwner = m.userId === tripRecord.ownerId || m.role === "owner";
      const displayName =
        authMap.get(m.userId) ||
        profileMap.get(m.userId) ||
        (isCurrentLogin ? user.displayName : isOwner ? "Trip Host" : "Co-Traveller");

      const lat = m.latitude ? parseFloat(m.latitude) : undefined;
      const lng = m.longitude ? parseFloat(m.longitude) : undefined;

      return {
        userId: m.userId,
        displayName,
        role: isOwner ? "owner" : "member",
        latitude: !isNaN(lat!) ? lat : undefined,
        longitude: !isNaN(lng!) ? lng : undefined,
        lastLocationAt: m.lastLocationAt,
      };
    });

    return NextResponse.json({ success: true, members: membersWithLocations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch member locations" }, { status: 500 });
  }
}
