import { NextResponse } from "next/server";
import { getDetailedDirections } from "@/lib/routing";

export async function POST(req: Request) {
  try {
    const { coordinates, mode = "driving" } = await req.json();

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: "At least two coordinates [lng, lat] are required." },
        { status: 400 }
      );
    }

    const result = await getDetailedDirections(coordinates, mode);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to calculate directions" },
      { status: 500 }
    );
  }
}
