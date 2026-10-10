import { NextResponse } from "next/server";
import { checkItineraryConflicts, StopConflictInput } from "@/lib/conflicts";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const body = await req.json();
    const { stops = [], dailyStart = "09:00", dailyEnd = "21:00", budgetPaise = 0 } = body;

    const conflicts = checkItineraryConflicts(
      stops as StopConflictInput[],
      dailyStart,
      dailyEnd,
      budgetPaise
    );

    return NextResponse.json({
      tripId,
      conflicts,
      hasBlockingErrors: conflicts.some((c) => c.severity === "error"),
      totalConflicts: conflicts.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to check conflicts" }, { status: 500 });
  }
}
