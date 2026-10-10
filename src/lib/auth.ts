import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { userAuth, profile } from "@/db/schema";
import { eq } from "drizzle-orm";

const SESSION_COOKIE_NAME = "voyara_session";
const SECRET_KEY = process.env.NEON_AUTH_COOKIE_SECRET || "voyara_super_secret_session_key_2026";

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
}

// 1. Password Hashing using Node.js crypto (pbkdf2)
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.pbkdf2(password, salt, 10000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = combinedHash.split(":");
    if (parts.length !== 2) return resolve(false);
    const [salt, key] = parts;
    crypto.pbkdf2(password, salt, 10000, 64, "sha512", (err, derivedKey) => {
      if (err) return resolve(false);
      resolve(key === derivedKey.toString("hex"));
    });
  });
}

// 2. Session Cookie Signing & Verification
export function signSessionToken(payload: SessionUser): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const hmac = crypto.createHmac("sha256", SECRET_KEY).update(data).digest("hex");
  return `${Buffer.from(data).toString("base64url")}.${hmac}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encodedData, signature] = parts;
    const dataStr = Buffer.from(encodedData, "base64url").toString("utf-8");
    const expectedHmac = crypto.createHmac("sha256", SECRET_KEY).update(dataStr).digest("hex");

    if (signature !== expectedHmac) return null;

    const parsed = JSON.parse(dataStr);
    if (parsed.exp && parsed.exp < Date.now()) return null;

    return {
      userId: parsed.userId,
      email: parsed.email,
      displayName: parsed.displayName,
    };
  } catch {
    return null;
  }
}

// 3. Server-side session retrieval
export async function getSessionUser(req?: Request): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.split("; ").find((row) => row.startsWith(`${SESSION_COOKIE_NAME}=`));
    if (match) {
      token = match.split("=")[1];
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {}
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days
};
