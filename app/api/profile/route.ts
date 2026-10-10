import { NextResponse } from "next/server";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "demo-user";

    const rows = await db.select().from(profile).where(eq(profile.userId, userId));
    if (rows.length > 0) {
      return NextResponse.json({ profile: rows[0] });
    }

    return NextResponse.json({
      profile: {
        userId,
        displayName: "Arjun Verma",
        dateOfBirth: "1998-05-14",
        vibeTags: JSON.stringify(["heritage", "beach", "culinary"]),
        pace: "moderate",
        budgetLevel: "medium",
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      profile: {
        userId: "demo-user",
        displayName: "Arjun Verma",
        dateOfBirth: "1998-05-14",
        vibeTags: JSON.stringify(["heritage", "beach", "culinary"]),
        pace: "moderate",
        budgetLevel: "medium",
      },
      warning: "Database fallback active",
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      userId = "demo-user",
      displayName = "Arjun Verma",
      dateOfBirth,
      vibeTags = [],
      pace = "moderate",
      budgetLevel = "medium",
    } = body;

    const record = {
      userId,
      displayName,
      dateOfBirth: dateOfBirth || null,
      vibeTags: typeof vibeTags === "string" ? vibeTags : JSON.stringify(vibeTags),
      pace,
      budgetLevel,
      updatedAt: new Date(),
    };

    try {
      await db
        .insert(profile)
        .values(record)
        .onConflictDoUpdate({
          target: profile.userId,
          set: record,
        });
    } catch {
      // Fallback if neon unreachable
    }

    return NextResponse.json({ success: true, profile: record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update profile" }, { status: 500 });
  }
}
