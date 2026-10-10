import { NextResponse } from "next/server";
import { db } from "@/db";
import { tripMember } from "@/db/schema";
import { resolveTripRecord } from "@/lib/trips-db";
import { getSessionUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

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
    const { userId, role = "member" } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const [member] = await db
      .insert(tripMember)
      .values({
        tripId: tripRecord.id,
        userId,
        role,
      })
      .onConflictDoNothing()
      .returning();

    return NextResponse.json({ success: true, member });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add member" }, { status: 500 });
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
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await db
      .delete(tripMember)
      .where(and(eq(tripMember.tripId, tripRecord.id), eq(tripMember.userId, userId)));

    return NextResponse.json({ success: true, deletedUserId: userId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to remove member" }, { status: 500 });
  }
}

