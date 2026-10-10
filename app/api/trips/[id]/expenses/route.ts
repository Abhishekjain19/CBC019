import { NextResponse } from "next/server";
import { db } from "@/db";
import { expense, expenseSplit } from "@/db/schema";
import { calculateEqualSplit, validateExactSplit, SplitResult } from "@/lib/expenses";
import { resolveTripRecord } from "@/lib/trips-db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tripId } = await params;
    const body = await req.json();

    const {
      payerId = "demo-user",
      amountPaise,
      category = "misc",
      note = "",
      splitType = "equal",
      participants = [payerId],
      exactSplits = [],
    } = body;

    const amount = Number(amountPaise);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount. Must be a positive value in paise." }, { status: 400 });
    }

    let calculatedSplits: SplitResult[] = [];

    if (splitType === "equal") {
      const splitUsers = participants.includes(payerId) ? participants : [payerId, ...participants];
      const result = calculateEqualSplit(amount, payerId, splitUsers);
      calculatedSplits = result.splits;
    } else {
      if (!validateExactSplit(amount, exactSplits)) {
        return NextResponse.json(
          { error: "Exact shares do not sum to total expense amount." },
          { status: 400 }
        );
      }
      calculatedSplits = exactSplits;
    }

    const tripRecord = await resolveTripRecord(tripId);
    if (!tripRecord) {
      return NextResponse.json({ error: "Trip not found in database" }, { status: 404 });
    }

    const [newExpense] = await db
      .insert(expense)
      .values({
        tripId: tripRecord.id,
        payerId,
        amountPaise: amount,
        category,
        note,
        splitType,
        version: 1,
        createdBy: payerId,
      })
      .returning();

    for (const s of calculatedSplits) {
      await db
        .insert(expenseSplit)
        .values({
          expenseId: newExpense.id,
          userId: s.userId,
          sharePaise: s.sharePaise,
        })
        .onConflictDoNothing();
    }

    return NextResponse.json({
      success: true,
      expense: {
        ...newExpense,
        spentAt: newExpense.spentAt ? new Date(newExpense.spentAt).toISOString() : new Date().toISOString(),
      },
      splits: calculatedSplits,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to record expense" }, { status: 500 });
  }
}
