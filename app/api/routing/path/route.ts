import { NextResponse } from "next/server";

const ORS_API_KEY = process.env.ORS_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { coordinates, mode = "driving-car" } = await req.json();

    if (!coordinates || coordinates.length < 2) {
      return NextResponse.json({ error: "At least two coordinates required." }, { status: 400 });
    }

    if (!ORS_API_KEY) {
      // Fallback to straight lines if no key
      return NextResponse.json({
        success: true,
        geometry: {
          type: "LineString",
          coordinates,
        },
      });
    }

    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${mode}/geojson`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": ORS_API_KEY,
        "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8"
      },
      body: JSON.stringify({ coordinates }),
    });

    if (!res.ok) {
      throw new Error(`ORS API error: ${res.statusText}`);
    }

    const data = await res.json();
    const feature = data.features?.[0];
    
    return NextResponse.json({
      success: true,
      geometry: feature?.geometry || { type: "LineString", coordinates },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to calculate path" }, { status: 500 });
  }
}
