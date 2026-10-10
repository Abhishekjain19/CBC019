import { NextResponse } from "next/server";
import { getRouteBetweenPoints } from "@/lib/routing";

export async function POST(req: Request) {
  try {
    const { origin, destination, mode = "driving" } = await req.json();

    if (!origin || !destination || origin.lat == null || destination.lat == null) {
      return NextResponse.json(
        { error: "Origin and destination coordinates (lat, lng) are required." },
        { status: 400 }
      );
    }

    const route = await getRouteBetweenPoints(origin, destination, mode);

    return NextResponse.json({
      success: true,
      route,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to calculate route" }, { status: 500 });
  }
}
