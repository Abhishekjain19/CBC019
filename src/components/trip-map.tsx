"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.js");
}

import {
  Navigation,
  Compass,
  MapPin,
  X,
  Play,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  Flag,
  Car,
  Footprints,
  Bike,
  Layers,
  Sparkles,
  Bookmark,
  Plus,
} from "lucide-react";

export interface MapPlace {
  id: string;
  name: string;
  category: string;
  latitude: number | string;
  longitude: number | string;
  order?: number;
}

export interface TripMemberMapInfo {
  userId: string;
  displayName: string;
  role?: string;
  latitude?: number;
  longitude?: number;
}

export interface DirectionStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
  type?: string;
  location?: [number, number];
}

/**
 * Calculates bearing angle (degrees 0-360) between two lat/lng points for directional arrows
 */
function calculateBearing(startLng: number, startLat: number, destLng: number, destLat: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}


export interface PoiInfo {
  id: string;
  name: string;
  category: "restaurant" | "hotel" | "store" | "medical";
  parentPlaceName: string;
  latitude: number;
  longitude: number;
  avgPricing: string;
  rating: number;
  reviewsCount: number;
  openingHours: string;
  status?: string;
  speciality: string;
  distanceMeter: number;
  imageUrl?: string;
}

export interface TripMapProps {
  places: MapPlace[];
  destination?: string;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  className?: string;
  members?: TripMemberMapInfo[];
  subItineraryTitle?: string;
  onClearSubItinerary?: () => void;
  /** User's pre-obtained GPS coordinates [lng, lat] — used to seed live nav start position */
  userInitialCoords?: [number, number];
}

export default function TripMap({
  places = [],
  destination = "Goa",
  center,
  zoom = 11,
  className = "w-full h-[520px] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl relative",
  members = [],
  subItineraryTitle,
  onClearSubItinerary,
  userInitialCoords,
}: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<PoiInfo | null>(null);
  const [activePoiCategory, setActivePoiCategory] = useState<"none" | "restaurant" | "hotel" | "store" | "medical" | "all">("none");

  // Live Navigation State (off by default so itinerary scale is preserved)
  const [isLiveNav, setIsLiveNav] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [navMode, setNavMode] = useState<"driving" | "walking" | "cycling">("driving");
  const [directions, setDirections] = useState<{
    geometry: any;
    distanceMeters: number;
    durationSeconds: number;
    steps: DirectionStep[];
    source: string;
  } | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);

  // Comprehensive destination coordinates mapping
  const defaultCenters: Record<string, [number, number]> = {
    Goa: [73.9116, 15.35],
    Coorg: [75.7381, 12.4225],
    Hampi: [76.4600, 15.3353],
    Bengaluru: [77.5946, 12.9716],
    Bangalore: [77.5946, 12.9716],
    Mumbai: [72.8777, 19.0760],
    Delhi: [77.2090, 28.6139],
    "New Delhi": [77.2090, 28.6139],
    Jaipur: [75.7873, 26.9124],
    Kerala: [76.2711, 9.9312],
    Kochi: [76.2711, 9.9312],
    Udaipur: [73.7125, 24.5854],
    Manali: [77.1887, 32.2432],
    Shimla: [77.1734, 31.1048],
    Ooty: [76.6957, 11.4102],
    Munnar: [77.0595, 10.0889],
    Pondicherry: [79.8083, 11.9416],
    Puducherry: [79.8083, 11.9416],
    Mysuru: [76.6394, 12.2958],
    Mysore: [76.6394, 12.2958],
    Agra: [78.0081, 27.1767],
    Varanasi: [82.9739, 25.3176],
    Rishikesh: [78.2676, 30.0869],
  };

  // Extract valid coordinates safely
  const validPlaces = places.filter((p) => {
    const lat = parseFloat(String(p.latitude));
    const lng = parseFloat(String(p.longitude));
    return !isNaN(lat) && !isNaN(lng);
  });

  const validCoords: [number, number][] = validPlaces.map((p) => [
    parseFloat(String(p.longitude)),
    parseFloat(String(p.latitude)),
  ]);

  // Compute centroid of itinerary places if available
  const computedCentroid: [number, number] | null = useMemo(() => {
    if (validCoords.length === 0) return null;
    const sumLng = validCoords.reduce((sum, c) => sum + c[0], 0);
    const sumLat = validCoords.reduce((sum, c) => sum + c[1], 0);
    return [sumLng / validCoords.length, sumLat / validCoords.length];
  }, [JSON.stringify(validCoords)]);

  const matchedDestKey = destination
    ? Object.keys(defaultCenters).find((k) => k.toLowerCase() === destination.trim().toLowerCase()) || destination
    : "Goa";

  const initialCenter = center || computedCentroid || defaultCenters[matchedDestKey] || defaultCenters["Goa"] || [73.9116, 15.35];

  // Fetch detailed directions from API
  const fetchDirections = useCallback(
    async (coords: [number, number][], mode: "driving" | "walking" | "cycling") => {
      if (coords.length < 2) return;
      setIsFetchingRoute(true);
      try {
        const res = await fetch("/api/routing/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates: coords, mode }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.geometry) {
            setDirections({
              geometry: data.geometry,
              distanceMeters: data.distanceMeters || 0,
              durationSeconds: data.durationSeconds || 0,
              steps: data.steps || [],
              source: data.source || "ors",
            });
            setCurrentStepIndex(0);

            // Update route layer on map smoothly without re-initializing
            if (mapRef.current) {
              const map = mapRef.current;
              const source = map.getSource("route-line") as maplibregl.GeoJSONSource;
              if (source) {
                source.setData({
                  type: "Feature",
                  properties: {},
                  geometry: data.geometry,
                });
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch turn-by-turn directions:", e);
      } finally {
        setIsFetchingRoute(false);
      }
    },
    []
  );

  // 1. INITIALIZE MAP ONCE (No re-initialization on props change)
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm-layer",
            type: "raster",
            source: "osm",
            paint: {
              "raster-opacity": 0.85,
            },
          },
        ],
      },
      center: initialCenter,
      zoom,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      // Add empty route source & layers once map style loads
      map.addSource("route-line", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route-line",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "rgba(0,0,0,0.4)",
          "line-width": 6,
        },
      });

      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#dfb26c",
          "line-width": 3.5,
        },
      });

      setMapLoaded(true);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      if (userMarkerRef.current) userMarkerRef.current.remove();
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // 2. DYNAMICALLY UPDATE MARKERS & ROUTE LINE (Without map tearing/flickering)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add Stop Place Markers
    validPlaces.forEach((p, idx) => {
      const lat = parseFloat(String(p.latitude));
      const lng = parseFloat(String(p.longitude));

      const el = document.createElement("div");
      el.className = "flex items-center justify-center cursor-pointer";
      el.style.cssText = `
        background: #dfb26c;
        color: #000;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 800;
        box-shadow: 0 4px 18px rgba(223, 178, 108, 0.7);
        border: 2.5px solid rgba(0,0,0,0.9);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        cursor: pointer;
      `;
      el.textContent = String(p.order !== undefined ? p.order : idx + 1);

      el.addEventListener("mouseover", () => {
        el.style.transform = "scale(1.25)";
        el.style.boxShadow = "0 6px 28px rgba(223, 178, 108, 0.95)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
        el.style.boxShadow = "0 4px 18px rgba(223, 178, 108, 0.7)";
      });

      const popup = new maplibregl.Popup({ offset: 28, closeButton: false }).setHTML(`
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 8px; min-width: 140px; background: #121214; color: #fff; border-radius: 10px;">
          <div style="font-weight: 700; font-size: 13px; color: #dfb26c; margin-bottom: 2px;">${p.name}</div>
          <div style="font-size: 11px; color: #a1a1aa; text-transform: capitalize;">${p.category}</div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);

      // =========================================================================
      // DYNAMIC NEARBY POIS (Filtered by activePoiCategory to prevent clutter)
      // =========================================================================
      if (activePoiCategory !== "none") {
        const poiList: PoiInfo[] = [
          {
            id: `poi-rest-${p.id}`,
            name: `${p.name} Gourmet Bistro & Dining`,
            category: "restaurant",
            parentPlaceName: p.name,
            latitude: lat + 0.0016,
            longitude: lng + 0.0012,
            avgPricing: "₹450 - ₹1,200 / person",
            rating: 4.7,
            reviewsCount: 2180,
            openingHours: "Opens 11:00 AM Mon",
            status: "Open • Closes 11:30 PM",
            speciality: "Fresh Goan seafood thali, woodfired pizza & craft beverages",
            distanceMeter: 140,
            imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: `poi-hotel-${p.id}`,
            name: `${p.name} Grand Resort & Suites`,
            category: "hotel",
            parentPlaceName: p.name,
            latitude: lat + 0.0022,
            longitude: lng - 0.0018,
            avgPricing: "₹4,200 - ₹8,500 / night",
            rating: 4.9,
            reviewsCount: 4660,
            openingHours: "24 Hours Open",
            status: "Open 24/7 • Front Desk Active",
            speciality: "Ocean view balcony suites, infinity pool, luxury spa & breakfast",
            distanceMeter: 220,
            imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: `poi-store-${p.id}`,
            name: `${p.name} Express Supermart & Provisions`,
            category: "store",
            parentPlaceName: p.name,
            latitude: lat - 0.0014,
            longitude: lng - 0.0015,
            avgPricing: "Standard MRP / Budget",
            rating: 4.5,
            reviewsCount: 890,
            openingHours: "Opens 7:00 AM Mon",
            status: "Open • Closes 10:30 PM",
            speciality: "Cold beverages, travel snacks, sunscreen & battery packs",
            distanceMeter: 110,
            imageUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: `poi-med-${p.id}`,
            name: `${p.name} 24/7 MedPlus Pharmacy`,
            category: "medical",
            parentPlaceName: p.name,
            latitude: lat - 0.0018,
            longitude: lng + 0.0016,
            avgPricing: "Standard Health Rates",
            rating: 4.8,
            reviewsCount: 1420,
            openingHours: "24 Hours Open",
            status: "Open 24/7 • Emergency Service",
            speciality: "Prescription medicines, first-aid kits & travel wellness",
            distanceMeter: 160,
            imageUrl: "https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=400&q=80",
          },
        ];

        const matchingPois = poiList.filter(
          (poi) => activePoiCategory === "all" || poi.category === activePoiCategory
        );

        matchingPois.forEach((poi) => {
          const poiEl = document.createElement("div");
          poiEl.className = "cursor-pointer transition-transform hover:scale-125";
          const isRest = poi.category === "restaurant";
          const isHotel = poi.category === "hotel";
          const isMed = poi.category === "medical";

          poiEl.style.cssText = `
            background: ${isHotel ? "#a855f7" : isRest ? "#f59e0b" : isMed ? "#ef4444" : "#10b981"};
            color: #fff;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 4px;
            border: 2px solid rgba(255,255,255,0.9);
            box-shadow: 0 4px 14px ${
              isHotel
                ? "rgba(168,85,247,0.6)"
                : isRest
                ? "rgba(245,158,11,0.6)"
                : isMed
                ? "rgba(239,68,68,0.6)"
                : "rgba(16,185,129,0.6)"
            };
            cursor: pointer;
          `;

          poiEl.innerHTML = `
            <span>${isHotel ? "🏨 Hotel" : isRest ? "🍽️ Food" : isMed ? "💊 Pharmacy" : "🛒 Store"}</span>
          `;

          poiEl.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedPoi(poi);
          });

          const poiMarker = new maplibregl.Marker({ element: poiEl })
            .setLngLat([poi.longitude, poi.latitude])
            .addTo(map);

          markersRef.current.push(poiMarker);
        });
      }
    });

    // Add Trip Member (People) Live Markers
    members.forEach((m) => {
      const mLat = m.latitude;
      const mLng = m.longitude;

      if (mLat !== undefined && mLng !== undefined && !isNaN(mLat) && !isNaN(mLng)) {
        const isOrganizer = m.role === "owner";
        const initial = (m.displayName.charAt(0) || "M").toUpperCase();

        const memberEl = document.createElement("div");
        memberEl.className = "group relative cursor-pointer flex items-center gap-1.5 px-2.5 py-1 bg-zinc-950/95 border border-emerald-500/60 text-white rounded-full text-xs font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-110 hover:z-30";
        memberEl.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-full h-full rounded-full bg-emerald-400/40 animate-ping"></span>
            <div class="w-5 h-5 rounded-full ${isOrganizer ? "bg-[var(--gold)] text-black" : "bg-emerald-400 text-black"} flex items-center justify-center text-[10px] font-black shrink-0 shadow">
              ${initial}
            </div>
          </div>
          <span class="max-w-[90px] truncate text-[11px] text-zinc-100 font-semibold">${m.displayName.split(" ")[0]}</span>
          ${isOrganizer ? `<span class="text-[9px] text-[var(--gold)] font-black uppercase tracking-wider">Host</span>` : `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>`}
        `;

        const mMarker = new maplibregl.Marker({ element: memberEl })
          .setLngLat([mLng, mLat])
          .addTo(map);

        markersRef.current.push(mMarker);
      }
    });

    // Add Google Maps Style Directional Path Arrows along Route Segments
    for (let i = 0; i < validCoords.length - 1; i++) {
      const p1 = validCoords[i];
      const p2 = validCoords[i + 1];
      const midLng = (p1[0] + p2[0]) / 2;
      const midLat = (p1[1] + p2[1]) / 2;
      const heading = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

      const arrowEl = document.createElement("div");
      arrowEl.className = "flex items-center justify-center pointer-events-none";
      arrowEl.style.cssText = `
        background: rgba(18, 18, 20, 0.95);
        color: #dfb26c;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 1.5px solid #dfb26c;
        box-shadow: 0 4px 14px rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${heading}deg);
        z-index: 5;
      `;
      arrowEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
          <polygon points="12,2 2,22 12,18 22,22" />
        </svg>
      `;

      const arrowMarker = new maplibregl.Marker({ element: arrowEl })
        .setLngLat([midLng, midLat])
        .addTo(map);

      markersRef.current.push(arrowMarker);
    }


    // Update Route Line & Fetch Directions
    if (validCoords.length > 1) {
      const source = map.getSource("route-line") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: validCoords,
          },
        });
      }
      fetchDirections(validCoords, navMode);

      // Fit bounds cleanly
      const bounds = validCoords.reduce(
        (b, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(validCoords[0], validCoords[0])
      );
      map.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    } else {
      const source = map.getSource("route-line") as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        });
      }
      setDirections(null);
    }
  }, [places.length, members.length, mapLoaded, navMode, activePoiCategory, JSON.stringify(validCoords)]);

  // 3. GEOLOCATION WATCH POSITION WHEN LIVE NAV IS ACTIVE
  // Seed initial coords from prop if available (avoids waiting for first watchPosition event)
  useEffect(() => {
    if (isLiveNav && userInitialCoords && !userCoords) {
      setUserCoords(userInitialCoords);
    }
  }, [isLiveNav, userInitialCoords]);

  useEffect(() => {
    if (!isLiveNav) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      if (userInitialCoords) {
        const currentPos = userInitialCoords;
        setUserCoords(currentPos);
        const map = mapRef.current;
        if (map && mapLoaded && !userMarkerRef.current) {
          const userEl = document.createElement("div");
          userEl.id = "user-nav-arrow-wrapper";
          userEl.className = "relative flex items-center justify-center cursor-pointer";
          const nextTarget = validCoords[0] || currentPos;
          const heading = calculateBearing(currentPos[0], currentPos[1], nextTarget[0], nextTarget[1]);
          userEl.innerHTML = `
            <div class="absolute w-12 h-12 rounded-full bg-[var(--gold)]/30 animate-ping"></div>
            <div class="user-arrow-cone w-10 h-10 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border-2 border-[var(--gold)] shadow-2xl flex items-center justify-center text-[var(--gold)]" style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 drop-shadow">
                <polygon points="12,2 2,22 12,18 22,22" />
              </svg>
            </div>
          `;
          userMarkerRef.current = new maplibregl.Marker({ element: userEl })
            .setLngLat(currentPos)
            .addTo(map);
          fetchDirections([currentPos, ...validCoords], navMode);
        }
      }
      return;
    }

    setGeoError(null);

    // If we already have a seeded initial position, place marker immediately without overriding camera zoom
    if (userInitialCoords && mapRef.current && mapLoaded && !userMarkerRef.current) {
      const seedPos = userInitialCoords;
      const map = mapRef.current;
      const nextTarget = validCoords[0] || seedPos;
      const heading = calculateBearing(seedPos[0], seedPos[1], nextTarget[0], nextTarget[1]);
      const userEl = document.createElement("div");
      userEl.id = "user-nav-arrow-wrapper";
      userEl.className = "relative flex items-center justify-center cursor-pointer";
      userEl.innerHTML = `
        <div class="absolute w-12 h-12 rounded-full bg-[var(--gold)]/30 animate-ping"></div>
        <div class="user-arrow-cone w-10 h-10 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border-2 border-[var(--gold)] shadow-2xl flex items-center justify-center text-[var(--gold)]" style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 drop-shadow">
            <polygon points="12,2 2,22 12,18 22,22" />
          </svg>
        </div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: userEl })
        .setLngLat(seedPos)
        .addTo(map);
      fetchDirections([seedPos, ...validCoords], navMode);
    }

    const handlePosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const currentPos: [number, number] = [longitude, latitude];
      setUserCoords(currentPos);

      const map = mapRef.current;
      if (map) {
        const nextTarget = validCoords[0] || currentPos;
        const userHeading = calculateBearing(currentPos[0], currentPos[1], nextTarget[0], nextTarget[1]);

        if (!userMarkerRef.current) {
          const userEl = document.createElement("div");
          userEl.id = "user-nav-arrow-wrapper";
          userEl.className = "relative flex items-center justify-center cursor-pointer";
          userEl.innerHTML = `
            <div class="absolute w-12 h-12 rounded-full bg-[var(--gold)]/30 animate-ping"></div>
            <div class="user-arrow-cone w-10 h-10 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border-2 border-[var(--gold)] shadow-2xl flex items-center justify-center text-[var(--gold)]" style="transform: rotate(${userHeading}deg); transition: transform 0.3s ease;">
              <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 drop-shadow">
                <polygon points="12,2 2,22 12,18 22,22" />
              </svg>
            </div>
          `;

          userMarkerRef.current = new maplibregl.Marker({ element: userEl })
            .setLngLat(currentPos)
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat(currentPos);
          const arrowEl = document.querySelector("#user-nav-arrow-wrapper .user-arrow-cone") as HTMLElement;
          if (arrowEl) {
            arrowEl.style.transform = `rotate(${userHeading}deg)`;
          }
        }

        // Route from current GPS position to all stops
        const routeCoords = [currentPos, ...validCoords];
        fetchDirections(routeCoords, navMode);
      }

    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn("Geolocation error:", err.message);
      setGeoError("Could not lock GPS position. Using route from nearest stop.");
      if (userInitialCoords && mapRef.current && !userMarkerRef.current) {
        const fallbackPos = userInitialCoords;
        setUserCoords(fallbackPos);
        const map = mapRef.current;
        const nextTarget = validCoords[0] || fallbackPos;
        const heading = calculateBearing(fallbackPos[0], fallbackPos[1], nextTarget[0], nextTarget[1]);
        const userEl = document.createElement("div");
        userEl.id = "user-nav-arrow-wrapper";
        userEl.className = "relative flex items-center justify-center cursor-pointer";
        userEl.innerHTML = `
          <div class="absolute w-12 h-12 rounded-full bg-[var(--gold)]/30 animate-ping"></div>
          <div class="user-arrow-cone w-10 h-10 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border-2 border-[var(--gold)] shadow-2xl flex items-center justify-center text-[var(--gold)]" style="transform: rotate(${heading}deg); transition: transform 0.3s ease;">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 drop-shadow">
              <polygon points="12,2 2,22 12,18 22,22" />
            </svg>
          </div>
        `;
        userMarkerRef.current = new maplibregl.Marker({ element: userEl })
          .setLngLat(fallbackPos)
          .addTo(map);
        fetchDirections([fallbackPos, ...validCoords], navMode);
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isLiveNav, navMode]);

  const recenterUser = () => {
    if (mapRef.current && userCoords) {
      mapRef.current.flyTo({ center: userCoords, zoom: 15, pitch: 30 });
    } else if (mapRef.current && validCoords.length > 0) {
      fitItineraryBounds();
    }
  };

  const fitItineraryBounds = () => {
    if (mapRef.current && validCoords.length > 0) {
      const bounds = validCoords.reduce(
        (b, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(validCoords[0], validCoords[0])
      );
      mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    }
  };

  const getManeuverIcon = (type?: string, instruction: string = "") => {
    const text = instruction.toLowerCase();
    if (text.includes("left") || type?.includes("left")) {
      return <CornerUpLeft className="w-7 h-7 text-[var(--gold)]" />;
    }
    if (text.includes("right") || type?.includes("right")) {
      return <CornerUpRight className="w-7 h-7 text-[var(--gold)]" />;
    }
    if (text.includes("destination") || text.includes("arrive")) {
      return <Flag className="w-7 h-7 text-emerald-400" />;
    }
    return <ArrowUp className="w-7 h-7 text-[var(--gold)]" />;
  };

  const currentStep = directions?.steps?.[currentStepIndex];

  return (
    <div className={`relative ${className}`}>
      {/* Map Canvas */}
      <div ref={mapContainer} className="w-full h-full min-h-[420px]" />

      {/* Top Controls Overlay */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {subItineraryTitle ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/85 border border-[var(--gold)]/40 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[var(--gold)] animate-pulse" />
              <span>Sub-Itinerary: <strong className="text-[var(--gold)]">{subItineraryTitle}</strong></span>
              {onClearSubItinerary && (
                <button
                  onClick={onClearSubItinerary}
                  className="ml-1 text-zinc-400 hover:text-white transition-colors"
                  title="Show all stops"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 text-xs text-zinc-300 backdrop-blur-md flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>{destination} • {places.length} Stops</span>
            </div>
          )}

          {validCoords.length > 0 && (
            <button
              type="button"
              onClick={fitItineraryBounds}
              className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/20 text-xs text-white font-medium hover:bg-black backdrop-blur-md flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Fit map view to all trip itinerary stops"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span className="hidden sm:inline">Fit Trip Stops</span>
            </button>
          )}

          {userCoords && (
            <button
              type="button"
              onClick={recenterUser}
              className="px-3 py-1.5 rounded-xl bg-black/80 border border-white/20 text-xs text-white font-medium hover:bg-black backdrop-blur-md flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              title="Focus on my location"
            >
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">My Location</span>
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {!isLiveNav ? (
            <button
              onClick={() => setIsLiveNav(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl transition-all active:scale-95 bg-[var(--gold)] text-black border border-[var(--gold)] hover:bg-[#ebd2a0]"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Go Live (In-App Navigation)</span>
            </button>
          ) : (
            <button
              onClick={() => setIsLiveNav(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600/90 text-white shadow-xl backdrop-blur-md border border-red-500 hover:bg-red-700 transition-all active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit Live Navigation</span>
            </button>
          )}
        </div>
      </div>

      {/* GOOGLE MAPS STYLE TOP CATEGORY FILTER BAR */}
      {!isLiveNav && (
        <div className="absolute top-14 left-3 right-3 z-20 flex items-center gap-2 overflow-x-auto pb-1 pointer-events-auto no-scrollbar">
          {[
            { id: "restaurant", label: "Restaurants", icon: "🍽️" },
            { id: "hotel", label: "Hotels", icon: "🏨" },
            { id: "store", label: "General Stores", icon: "🛒" },
            { id: "medical", label: "Medical Stores", icon: "💊" },
          ].map((cat) => {
            const isActive = activePoiCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedPoi(null);
                  setActivePoiCategory((prev) => (prev === cat.id ? "none" : (cat.id as any)));
                }}
                className={`btn-press px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-md shrink-0 backdrop-blur-md ${
                  isActive
                    ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-lg shadow-[var(--gold)]/30 font-bold scale-105"
                    : "bg-black/80 text-white border-white/20 hover:bg-black/95 hover:border-white/40"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}

          {activePoiCategory !== "none" && (
            <button
              type="button"
              onClick={() => {
                setActivePoiCategory("none");
                setSelectedPoi(null);
              }}
              className="btn-press px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition shrink-0 backdrop-blur-md"
            >
              Clear POIs ✕
            </button>
          )}
        </div>
      )}

      {/* TURN-BY-TURN LIVE NAVIGATION OVERLAY BANNER */}
      {isLiveNav && (
        <div className="absolute top-14 left-3 right-3 z-30 flex flex-col gap-2">
          <div className="p-4 rounded-2xl bg-black/90 border border-[var(--gold)]/60 text-white shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 flex items-center justify-center shrink-0">
                {getManeuverIcon(currentStep?.type, currentStep?.instruction)}
              </div>
              <div>
                <div className="text-xs text-[var(--gold)] font-mono font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  <span>Step {currentStepIndex + 1} of {directions?.steps?.length || 1}</span>
                  {currentStep?.distanceMeters ? (
                    <span className="text-zinc-400 font-normal">• in {currentStep.distanceMeters > 1000 ? `${(currentStep.distanceMeters / 1000).toFixed(1)} km` : `${currentStep.distanceMeters} m`}</span>
                  ) : null}
                </div>
                <div className="text-sm font-bold text-white mt-0.5 leading-snug">
                  {currentStep?.instruction || "Proceeding along the live trip route..."}
                </div>
              </div>
            </div>

            {directions?.steps && directions.steps.length > 1 && (
              <div className="flex items-center gap-1 shrink-0 bg-white/10 p-1 rounded-xl">
                <button
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-white"
                  title="Previous Step"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentStepIndex === directions.steps.length - 1}
                  onClick={() => setCurrentStepIndex((prev) => Math.min(directions.steps.length - 1, prev + 1))}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-white"
                  title="Next Step"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 rounded-xl bg-black/80 border border-white/10 text-white shadow-xl backdrop-blur-md flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="text-zinc-400 font-medium">Mode:</span>
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                <button
                  onClick={() => setNavMode("driving")}
                  className={`p-1 rounded ${navMode === "driving" ? "bg-[var(--gold)] text-black" : "text-zinc-400"}`}
                  title="Driving Mode"
                >
                  <Car className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setNavMode("walking")}
                  className={`p-1 rounded ${navMode === "walking" ? "bg-[var(--gold)] text-black" : "text-zinc-400"}`}
                  title="Walking Mode"
                >
                  <Footprints className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setNavMode("cycling")}
                  className={`p-1 rounded ${navMode === "cycling" ? "bg-[var(--gold)] text-black" : "text-zinc-400"}`}
                  title="Cycling Mode"
                >
                  <Bike className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {directions && (
              <div className="flex items-center gap-4 font-mono">
                <div>
                  <span className="text-zinc-400 font-sans text-[11px] mr-1">DIST:</span>
                  <strong className="text-[var(--gold)]">
                    {(directions.distanceMeters / 1000).toFixed(1)} km
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-400 font-sans text-[11px] mr-1">ETA:</span>
                  <strong className="text-emerald-400">
                    {Math.round(directions.durationSeconds / 60)} min
                  </strong>
                </div>
              </div>
            )}

            <button
              onClick={recenterUser}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-[var(--gold)]" />
              <span>Recenter</span>
            </button>
          </div>

          {geoError && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] text-center backdrop-blur-md">
              ⚠️ {geoError}
            </div>
          )}
        </div>
      )}

      {/* GOOGLE MAPS STYLE POI POPUP CARD OVERLAY */}
      {selectedPoi && (
        <div className="absolute bottom-3 left-3 sm:left-auto sm:right-3 w-[calc(100%-24px)] sm:w-96 z-40 rounded-2xl bg-zinc-950 text-white shadow-2xl border border-white/20 overflow-hidden animate-in slide-in-from-bottom duration-200">
          {/* Header Image Banner */}
          <div className="relative h-28 w-full bg-gradient-to-r from-zinc-800 via-zinc-900 to-black overflow-hidden flex items-center justify-center">
            {selectedPoi.imageUrl ? (
              <img
                src={selectedPoi.imageUrl}
                alt={selectedPoi.name}
                className="w-full h-full object-cover opacity-85"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-amber-900/40 via-purple-900/30 to-emerald-900/40 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[var(--gold)]/60" />
              </div>
            )}
            <button
              onClick={() => setSelectedPoi(null)}
              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center text-xs backdrop-blur-md transition shadow-md"
              title="Close POI Details"
            >
              <X className="w-4 h-4" />
            </button>

            <span className={`absolute bottom-2.5 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md backdrop-blur-md ${
              selectedPoi.category === "restaurant"
                ? "bg-amber-500 text-black"
                : selectedPoi.category === "hotel"
                ? "bg-purple-500 text-white"
                : selectedPoi.category === "medical"
                ? "bg-rose-500 text-white"
                : "bg-emerald-500 text-black"
            }`}>
              {selectedPoi.category === "restaurant" ? "🍽️ Restaurant" : selectedPoi.category === "hotel" ? "🏨 Hotel" : selectedPoi.category === "medical" ? "💊 Pharmacy" : "🛒 General Store"}
            </span>
          </div>

          {/* Card Body */}
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-serif font-bold text-white leading-snug">
                  {selectedPoi.name}
                </h4>
                <div className="flex items-center gap-1.5 text-xs mt-1">
                  <span className="font-bold text-amber-400">{selectedPoi.rating}</span>
                  <div className="flex items-center text-amber-400 text-[11px]">
                    {"★".repeat(Math.floor(selectedPoi.rating))}
                  </div>
                  <span className="text-zinc-400 text-[11px]">({selectedPoi.reviewsCount.toLocaleString()})</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="capitalize text-zinc-300">{selectedPoi.category}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">{selectedPoi.status || "Open Now"}</span>
                </div>
              </div>

              {/* Action Buttons (Direction + Save) */}
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (mapRef.current) {
                      mapRef.current.flyTo({ center: [selectedPoi.longitude, selectedPoi.latitude], zoom: 15 });
                    }
                  }}
                  className="w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 transition active:scale-95"
                  title="Center & Navigate"
                >
                  <Navigation className="w-4 h-4 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={() => alert(`Saved ${selectedPoi.name} to your trip places!`)}
                  className="w-9 h-9 rounded-full bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-md transition active:scale-95"
                  title="Bookmark / Save"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid Specs */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase font-medium">Avg Pricing</span>
                <span className="font-mono font-bold text-[var(--gold)]">{selectedPoi.avgPricing}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-400 block uppercase font-medium">Proximity</span>
                <span className="text-emerald-400 font-semibold text-[11px]">~{selectedPoi.distanceMeter}m from {selectedPoi.parentPlaceName}</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed">
              💡 <strong className="text-zinc-200">Highlights:</strong> {selectedPoi.speciality}
            </p>
          </div>
        </div>
      )}

      {/* People / Members list overlay bottom-left */}
      {members.length > 0 && !isLiveNav && !selectedPoi && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 p-2 rounded-xl bg-black/80 border border-white/10 backdrop-blur-md text-xs text-white">
          <Users className="w-4 h-4 text-[var(--gold)] shrink-0 ml-1" />
          <span className="text-zinc-400 font-medium mr-1">On Map:</span>
          <div className="flex items-center -space-x-1.5">
            {members.slice(0, 4).map((m) => (
              <div
                key={m.userId}
                className="w-6 h-6 rounded-full bg-[var(--gold)] text-black font-black text-[10px] flex items-center justify-center border border-black shadow"
                title={`${m.displayName} (${m.role || "member"})`}
              >
                {m.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          {members.length > 4 && (
            <span className="text-[10px] text-zinc-400 font-bold ml-1">+{members.length - 4}</span>
          )}
        </div>
      )}

      {/* Map Attribution */}
      <div
        className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded text-[9px] backdrop-blur-md border"
        style={{
          background: "rgba(0,0,0,0.6)",
          color: "rgba(255,255,255,0.4)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        MapLibre GL • ORS / OSRM Routing
      </div>
    </div>
  );
}
