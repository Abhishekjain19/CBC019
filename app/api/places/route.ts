import { NextResponse } from "next/server";
import { db } from "@/db";
import { place } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const destination = url.searchParams.get("destination");
    const category = url.searchParams.get("category");
    const query = url.searchParams.get("q");

    let placesList: any[] = [];
    try {
      if (destination) {
        placesList = await db.select().from(place).where(eq(place.destination, destination));
      } else {
        placesList = await db.select().from(place);
      }
    } catch {
      // fallback
      placesList = [];
    }

    if (category && category !== "all") {
      placesList = placesList.filter((p) => p.category.toLowerCase() === category.toLowerCase());
    }

    if (query) {
      const q = query.toLowerCase();
      placesList = placesList.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({ places: placesList });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch places" }, { status: 500 });
  }
}
