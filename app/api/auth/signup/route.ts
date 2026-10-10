import { NextResponse } from "next/server";
import { db } from "@/db";
import { userAuth, profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, signSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, displayName } = body;

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: "Email, password, and name are required." }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    // Check existing email
    try {
      const existing = await db.select().from(userAuth).where(eq(userAuth.email, cleanEmail));
      if (existing.length > 0) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }
    } catch (e: any) {
      // Table might need creation on first hit
    }

    const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
    const passwordHash = await hashPassword(password);

    // Insert user credentials
    try {
      await db.insert(userAuth).values({
        id: userId,
        email: cleanEmail,
        passwordHash,
        displayName: displayName.trim(),
      });

      // Insert default profile
      await db.insert(profile).values({
        userId,
        displayName: displayName.trim(),
        pace: "moderate",
        budgetLevel: "medium",
        vibeTags: JSON.stringify(["nature", "heritage", "culinary"]),
      });
    } catch (err: any) {
      console.error("Signup DB insert error:", err);
    }

    const sessionPayload = { userId, email: cleanEmail, displayName: displayName.trim() };
    const token = signSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
    });

    response.cookies.set(SESSION_COOKIE_OPTIONS.name, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create account" }, { status: 500 });
  }
}
