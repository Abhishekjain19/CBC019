import { NextResponse } from "next/server";
import { computeSettlements, calculateEqualSplit } from "@/lib/expenses";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const body = await req.json();
    const { expenses = [], splits = [] } = body;

    const result = computeSettlements(expenses, splits);

    return NextResponse.json({
      tripId,
      balances: result.balances,
      settlements: result.settlements,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to calculate settlements" }, { status: 500 });
  }
}
