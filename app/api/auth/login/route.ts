import { NextResponse } from "next/server";
import { db } from "@/db";
import { userAuth } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, signSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const users = await db.select().from(userAuth).where(eq(userAuth.email, cleanEmail));
    if (users.length === 0) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const userRecord = users[0];
    const isValidPassword = await verifyPassword(password, userRecord.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const sessionPayload = {
      userId: userRecord.id,
      email: userRecord.email,
      displayName: userRecord.displayName,
    };

    const token = signSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
    });

    response.cookies.set(SESSION_COOKIE_OPTIONS.name, token, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Authentication failed" }, { status: 500 });
  }
}
