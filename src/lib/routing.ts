import { db } from "@/db";
import { routeCache } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import * as turf from "@turf/turf";

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteResult {
  durationMinutes: number;
  durationSeconds: number;
  distanceKm: number;
  distanceMeters: number;
  isApproximate: boolean;
  source: "ors" | "cache" | "haversine-estimate";
  geometry?: any;
}

const ORS_API_KEY = process.env.ORS_API_KEY || "";

/**
 * Calculates routing between two points using OpenRouteService with Neon DB caching,
 * and graceful fallback to Turf straight-line estimate (FR-33, NFR-03).
 */
export async function getRouteBetweenPoints(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
  mode: "driving" | "cycling" | "walking" = "driving"
): Promise<RouteResult> {
  const originKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`;
  const destKey = `${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;

  // 1. Check Neon DB Route Cache
  try {
    const cached = await db
      .select()
      .from(routeCache)
      .where(
        and(
          eq(routeCache.originKey, originKey),
          eq(routeCache.destinationKey, destKey),
          eq(routeCache.mode, mode)
        )
      );

    if (cached.length > 0) {
      const row = cached[0];
      return {
        durationSeconds: row.durationS,
        durationMinutes: Math.round(row.durationS / 60),
        distanceMeters: row.distanceM,
        distanceKm: Number((row.distanceM / 1000).toFixed(1)),
        isApproximate: row.isApproximate || false,
        source: "cache",
      };
    }
  } catch {
    // Cache lookup failed, continue to live lookup
  }

  // 2. Query OpenRouteService if API key is provided
  if (ORS_API_KEY) {
    try {
      const profile = mode === "walking" ? "foot-walking" : mode === "cycling" ? "cycling-regular" : "driving-car";
      const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${ORS_API_KEY}&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        const feature = data.features?.[0];
        if (feature?.properties?.summary) {
          const { duration, distance } = feature.properties.summary;
          const durationSeconds = Math.round(duration);
          const distanceMeters = Math.round(distance);

          // Save to Route Cache
          try {
            await db.insert(routeCache).values({
              originKey,
              destinationKey: destKey,
              mode,
              durationS: durationSeconds,
              distanceM: distanceMeters,
              source: "ors",
              isApproximate: false,
            });
          } catch {
            // Non-blocking
          }

          return {
            durationSeconds,
            durationMinutes: Math.round(durationSeconds / 60),
            distanceMeters,
            distanceKm: Number((distanceMeters / 1000).toFixed(1)),
            isApproximate: false,
            source: "ors",
            geometry: feature.geometry,
          };
        }
      }
    } catch {
      // Fallback below
    }
  }

  // 3. Fallback: Turf.js straight-line distance estimation
  const fromPoint = turf.point([origin.lng, origin.lat]);
  const toPoint = turf.point([destination.lng, destination.lat]);
  const distanceKm = turf.distance(fromPoint, toPoint, { units: "kilometers" });
  const distanceMeters = Math.round(distanceKm * 1000);

  // Approximate road factor 1.3x and average city speeds (30 km/h driving, 4.5 km/h walking)
  const speedKmh = mode === "walking" ? 4.5 : mode === "cycling" ? 15 : 30;
  const roadDistanceKm = distanceKm * 1.3;
  const durationSeconds = Math.round((roadDistanceKm / speedKmh) * 3600);

  return {
    durationSeconds,
    durationMinutes: Math.max(5, Math.round(durationSeconds / 60)),
    distanceMeters,
    distanceKm: Number(distanceKm.toFixed(1)),
    isApproximate: true,
    source: "haversine-estimate",
  };
}

export interface DirectionStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
  type?: string;
  location?: [number, number];
}

export interface DetailedDirectionsResult {
  source: "ors" | "osrm" | "fallback";
  geometry: any;
  distanceMeters: number;
  durationSeconds: number;
  steps: DirectionStep[];
}

/**
 * Gets detailed turn-by-turn directions and geometry for a sequence of coordinates [lng, lat].
 * Uses OpenRouteService if API key available, falls back to public OSRM server, then Turf straight-line.
 */
export async function getDetailedDirections(
  coordinates: [number, number][],
  mode: "driving" | "cycling" | "walking" = "driving"
): Promise<DetailedDirectionsResult> {
  if (!coordinates || coordinates.length < 2) {
    return {
      source: "fallback",
      geometry: { type: "LineString", coordinates: coordinates || [] },
      distanceMeters: 0,
      durationSeconds: 0,
      steps: [],
    };
  }

  // 1. Try OpenRouteService
  if (ORS_API_KEY) {
    try {
      const profile = mode === "walking" ? "foot-walking" : mode === "cycling" ? "cycling-regular" : "driving-car";
      const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({ coordinates }),
      });

      if (res.ok) {
        const data = await res.json();
        const feature = data.features?.[0];
        if (feature) {
          const summary = feature.properties?.summary || {};
          const segments = feature.properties?.segments || [];
          const rawSteps: DirectionStep[] = [];

          segments.forEach((seg: any) => {
            if (seg.steps) {
              seg.steps.forEach((step: any) => {
                rawSteps.push({
                  instruction: step.instruction || "Proceed along route",
                  distanceMeters: Math.round(step.distance || 0),
                  durationSeconds: Math.round(step.duration || 0),
                  name: step.name || "",
                  type: String(step.type || "continue"),
                });
              });
            }
          });

          return {
            source: "ors",
            geometry: feature.geometry,
            distanceMeters: Math.round(summary.distance || 0),
            durationSeconds: Math.round(summary.duration || 0),
            steps: rawSteps.length > 0 ? rawSteps : [
              { instruction: "Proceed along calculated route to destination", distanceMeters: Math.round(summary.distance || 0), durationSeconds: Math.round(summary.duration || 0) }
            ],
          };
        }
      }
    } catch (e) {
      console.warn("ORS Directions lookup failed, falling back to OSRM:", e);
    }
  }

  // 2. Fallback to OSRM Public Demo Server
  try {
    const coordsString = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
    const osrmProfile = mode === "walking" ? "foot" : mode === "cycling" ? "bike" : "driving";
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordsString}?overview=full&geometries=geojson&steps=true`;

    const osrmRes = await fetch(osrmUrl, { headers: { Accept: "application/json" } });
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      const route = osrmData.routes?.[0];
      if (route) {
        const steps: DirectionStep[] = [];
        route.legs?.forEach((leg: any) => {
          leg.steps?.forEach((step: any) => {
            const maneuverType = step.maneuver?.type || "turn";
            const modifier = step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : "";
            const streetName = step.name ? ` onto ${step.name}` : "";
            const instructionText = step.maneuver?.instruction || `${maneuverType}${modifier}${streetName}`;

            steps.push({
              instruction: instructionText.charAt(0).toUpperCase() + instructionText.slice(1),
              distanceMeters: Math.round(step.distance || 0),
              durationSeconds: Math.round(step.duration || 0),
              name: step.name || "",
              type: maneuverType,
              location: step.maneuver?.location,
            });
          });
        });

        return {
          source: "osrm",
          geometry: route.geometry,
          distanceMeters: Math.round(route.distance || 0),
          durationSeconds: Math.round(route.duration || 0),
          steps,
        };
      }
    }
  } catch (e) {
    console.warn("OSRM Directions lookup failed, falling back to straight line:", e);
  }

  // 3. Fallback: Straight Line geometry with basic generated steps
  let totalDistanceM = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = turf.point(coordinates[i]);
    const p2 = turf.point(coordinates[i + 1]);
    totalDistanceM += turf.distance(p1, p2, { units: "kilometers" }) * 1000;
  }
  const speedKmh = mode === "walking" ? 4.5 : mode === "cycling" ? 15 : 35;
  const durationSec = Math.round(((totalDistanceM / 1000) * 1.3 / speedKmh) * 3600);

  return {
    source: "fallback",
    geometry: {
      type: "LineString",
      coordinates,
    },
    distanceMeters: Math.round(totalDistanceM),
    durationSeconds: durationSec,
    steps: coordinates.map((coord, idx) => ({
      instruction: idx === 0 ? "Start journey from origin" : idx === coordinates.length - 1 ? "Arrive at final destination" : `Head towards Stop #${idx + 1}`,
      distanceMeters: Math.round(totalDistanceM / Math.max(1, coordinates.length - 1)),
      durationSeconds: Math.round(durationSec / Math.max(1, coordinates.length - 1)),
      location: coord,
    })),
  };
}

