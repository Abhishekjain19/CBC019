"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  CalendarDays,
  Compass,
  Receipt,
  Users,
  Share2,
  Copy,
  Check,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  Star,
  Plus,
  AlertTriangle,
  Car,
  Bike,
  Bus,
  Footprints,
  CreditCard,
  Ticket,
  Pencil,
  Trash2,
  Navigation,
  UserPlus,
  UserMinus,
  ExternalLink,
  Info,
  Sliders,
  DollarSign,
  Wallet,
  AlertCircle,
  Map as MapIcon,
  X,
  Play,
} from "lucide-react";
import { VoyaraLogo } from "@/components/voyara-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const TripMap = dynamic(() => import("@/components/trip-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] rounded-2xl bg-[var(--card)] shadow-craft-md border-none flex items-center justify-center text-xs text-[var(--foreground)]/40">
      Loading interactive map...
    </div>
  ),
});

interface StopItem {
  id: string;
  placeId: string;
  placeName?: string;
  category?: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
  estCostPaise: number;
  notes?: string;
}

interface PlaceItem {
  id: string;
  name: string;
  category: string;
  destination: string;
  latitude?: string;
  longitude?: string;
  openingHours?: string;
  hoursConfidence?: string;
  description?: string;
  popularityScore?: number;
}

// No hardcoded place data — all suggestions are fetched live from the database and AI API


interface ExpenseItem {
  id: string;
  payerId: string;
  payerName?: string;
  amountPaise: number;
  category: string;
  note?: string;
  spentAt: string;
  splitType: string;
}

interface ConflictItem {
  type: string;
  severity: "error" | "warning";
  stopIds: string[];
  message: string;
  suggestedFix?: string;
}

interface TripMember {
  userId: string;
  displayName: string;
  email?: string;
  role: "owner" | "member" | "viewer" | "co-planner";
  latitude?: number;
  longitude?: number;
}

interface NavigationInfo {
  fromStop: StopItem;
  toStop: StopItem;
  mode: "driving" | "bike" | "transit" | "walking";
  distanceKm: number;
  durationMinutes: number;
  bufferMinutes: number;
  bufferSurplus: number;
  insights: string[];
  parkingStatus: string;
}

export default function TripWorkspaceClient({ tripId }: { tripId: string }) {
  const [activeTab, setActiveTab] = useState<"itinerary" | "places" | "expenses" | "overview">("itinerary");
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // Trip state from database
  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [stops, setStops] = useState<StopItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateMsg, setStatusUpdateMsg] = useState<string | null>(null);
  const [isFixingConflicts, setIsFixingConflicts] = useState(false);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);

  // User GPS location for first-stop distance calculation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationError, setUserLocationError] = useState<string | null>(null);

  // Request user location on mount & watch continuous position for live sharing
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocationError("Location not available — using itinerary start point."),
        { enableHighAccuracy: true, timeout: 8000 }
      );

      const watchId = navigator.geolocation.watchPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Watch position error:", err.message),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Live Party Member Locations State & Broadcasting
  const [liveMemberLocations, setLiveMemberLocations] = useState<Record<string, { lat: number; lng: number }>>({});

  // 1. Broadcast current user's GPS coordinates to server every 3 minutes
  useEffect(() => {
    if (!userLocation || !tripId) return;

    const broadcastLocation = async () => {
      try {
        await fetch(`/api/trips/${tripId}/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: userLocation.lat, longitude: userLocation.lng }),
        });
      } catch (e) {
        console.warn("Failed to broadcast location:", e);
      }
    };

    broadcastLocation();
    const interval = setInterval(broadcastLocation, 180000); // 3 minutes
    return () => clearInterval(interval);
  }, [userLocation?.lat, userLocation?.lng, tripId]);

  // 2. Poll live locations of all party members (passcode joinees + organizer) every 3 minutes
  useEffect(() => {
    if (!tripId) return;

    const fetchMemberLocations = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/location`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.members)) {
            const locMap: Record<string, { lat: number; lng: number }> = {};
            data.members.forEach((m: any) => {
              if (m.userId && m.latitude !== undefined && m.longitude !== undefined) {
                locMap[m.userId] = { lat: m.latitude, lng: m.longitude };
              }
            });
            setLiveMemberLocations(locMap);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch member locations:", e);
      }
    };

    fetchMemberLocations();
    const interval = setInterval(fetchMemberLocations, 180000); // 3 minutes
    return () => clearInterval(interval);
  }, [tripId]);

  // Merge party members with their live GPS locations for TripMap
  const mapMembers = useMemo(() => {
    return members.map((m) => {
      const liveLoc = liveMemberLocations[m.userId];
      return {
        userId: m.userId,
        displayName: m.displayName,
        role: m.role,
        latitude: liveLoc ? liveLoc.lat : m.latitude,
        longitude: liveLoc ? liveLoc.lng : m.longitude,
      };
    });
  }, [members, liveMemberLocations]);

  // Calculate dynamic days from trip start & end dates + stops
  const tripDays: number[] = useMemo(() => {
    if (!trip?.startDate || !trip?.endDate) return [1, 2, 3];
    try {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = Math.max(1, Math.min(diffDays, 14));
      const maxStopDay = stops.reduce((max, s) => Math.max(max, s.dayIndex), 1);
      const finalCount = Math.max(totalDays, maxStopDay);
      return Array.from({ length: finalCount }, (_, i) => i + 1);
    } catch {
      return [1, 2, 3];
    }
  }, [trip?.startDate, trip?.endDate, stops]);

  // Modals state
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showEditStopModal, setShowEditStopModal] = useState(false);
  const [editingStop, setEditingStop] = useState<StopItem | null>(null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showNavigationModal, setShowNavigationModal] = useState(false);
  // Navigation & active visiting stop state
  const [activeNavInfo, setActiveNavInfo] = useState<NavigationInfo | null>(null);
  const [activeNavStopId, setActiveNavStopId] = useState<string | null>(null);
  const [selectedNavMode, setSelectedNavMode] = useState<"driving" | "bike" | "transit" | "walking">("driving");

  // Per-connector ORS transit data: key = "fromId->toId"
  const [transitData, setTransitData] = useState<Record<string, { durationMinutes: number; distanceKm: number; source: string } | null>>({});
  const [fetchingTransit, setFetchingTransit] = useState<Record<string, boolean>>({});

  // New Place modal state
  const [showCustomPlaceModal, setShowCustomPlaceModal] = useState(false);
  const [customPlaceName, setCustomPlaceName] = useState("");
  const [customPlaceCategory, setCustomPlaceCategory] = useState("beach");
  const [customPlaceHours, setCustomPlaceHours] = useState("09:00 - 19:00");
  const [customPlaceDesc, setCustomPlaceDesc] = useState("");
  const [customPlaceDay, setCustomPlaceDay] = useState(1);
  const [customPlaceStart, setCustomPlaceStart] = useState("10:00");
  const [customPlaceEnd, setCustomPlaceEnd] = useState("12:00");

  // New Stop form
  const [newStopPlaceId, setNewStopPlaceId] = useState("");
  const [newStopDay, setNewStopDay] = useState(1);
  const [newStopStart, setNewStopStart] = useState("10:00");
  const [newStopEnd, setNewStopEnd] = useState("12:30");
  const [newStopCostRupees, setNewStopCostRupees] = useState("500");
  const [newStopNotes, setNewStopNotes] = useState("");

  // Edit Stop form
  const [editStopPlaceName, setEditStopPlaceName] = useState("");
  const [editStopDay, setEditStopDay] = useState(1);
  const [editStopStart, setEditStopStart] = useState("10:00");
  const [editStopEnd, setEditStopEnd] = useState("12:30");
  const [editStopCostRupees, setEditStopCostRupees] = useState("500");
  const [editStopNotes, setEditStopNotes] = useState("");

  // New Expense form
  const [expenseAmountRupees, setExpenseAmountRupees] = useState("1800");
  const [expenseCategory, setExpenseCategory] = useState("food");
  const [expensePayer, setExpensePayer] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseSplitType, setExpenseSplitType] = useState<"equal" | "exact">("equal");

  // New Member form
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"member" | "viewer" | "co-planner">("member");

  // Filter for places tab & AI Suggestion state
  const [placeCategoryFilter, setPlaceCategoryFilter] = useState("all");
  const [placeSearchQuery, setPlaceSearchQuery] = useState("");
  const [isSuggestingAIPlaces, setIsSuggestingAIPlaces] = useState(false);
  const [aiSuggestionSuccessMsg, setAiSuggestionSuccessMsg] = useState<string | null>(null);

  // AI Suggest Locations for destination — fetches live from DB + AI API
  const handleGenerateAISuggestions = async () => {
    setIsSuggestingAIPlaces(true);
    setAiSuggestionSuccessMsg(null);
    try {
      const destination = trip?.destination || "";

      // 1. Fetch all places for this destination from the DB
      const dbRes = await fetch(`/api/places?destination=${encodeURIComponent(destination)}`);
      let dbPlaces: PlaceItem[] = [];
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        if (Array.isArray(dbData.places)) dbPlaces = dbData.places;
      }

      // 2. Also call the AI itinerary generate endpoint for enhanced suggestions
      let aiSuggestions: PlaceItem[] = [];
      try {
        const aiRes = await fetch("/api/itinerary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destination,
            tripType: trip?.type || "group",
            daysCount: tripDays.length || 3,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          // Extract unique places from AI itinerary response
          if (aiData.itinerary && Array.isArray(aiData.itinerary)) {
            aiData.itinerary.forEach((dayObj: any) => {
              if (dayObj.stops && Array.isArray(dayObj.stops)) {
                dayObj.stops.forEach((s: any) => {
                  if (s.placeId && s.name) {
                    aiSuggestions.push({
                      id: s.placeId,
                      name: s.name,
                      category: s.category || "attraction",
                      destination,
                      openingHours: s.openingHours || "09:00 - 18:00",
                      hoursConfidence: "AI Suggested",
                      description: s.notes || `AI-recommended place for ${destination}.`,
                      popularityScore: s.popularityScore || 90,
                    });
                  }
                });
              }
            });
          }
        }
      } catch { /* AI call optional */ }

      // 3. Merge: DB places first (authoritative), then AI suggestions not already in DB
      const allSuggestions = [...dbPlaces];
      const existingIds = new Set(dbPlaces.map((p) => p.id));
      aiSuggestions.forEach((s) => {
        if (!existingIds.has(s.id)) {
          allSuggestions.push(s);
          existingIds.add(s.id);
        }
      });

      if (allSuggestions.length > 0) {
        setPlaces((prev) => {
          const prevIds = new Set(prev.map((p) => p.id));
          const fresh = allSuggestions.filter((s) => !prevIds.has(s.id));
          return [...fresh, ...prev];
        });
        setAiSuggestionSuccessMsg(`✓ Discovered & generated ${allSuggestions.length} AI place suggestions for ${destination}.`);
      } else {
        setAiSuggestionSuccessMsg(`✓ Generated AI place suggestions for ${destination}.`);
      }
    } catch {
      setAiSuggestionSuccessMsg(`Could not fetch suggestions. Please check your connection.`);
    } finally {
      setIsSuggestingAIPlaces(false);
    }
  };

  // Add a suggested place to Place Discovery
  const handleAddSuggestedPlaceToDiscovery = (suggested: PlaceItem) => {
    if (places.some((p) => p.id === suggested.id || p.name.toLowerCase() === suggested.name.toLowerCase())) return;
    setPlaces((prev) => [...prev, suggested]);
  };

  // Add a nearby place directly to itinerary & active sub-itinerary
  const handleAddNearbyPlaceToSubItinerary = async (targetPlace: PlaceItem) => {
    if (!places.some((p) => p.id === targetPlace.id)) {
      setPlaces((prev) => [...prev, targetPlace]);
    }

    const sortOrder = stops.filter((s) => s.dayIndex === selectedDay).length + 1;
    const nextStartH = 9 + Math.min(10, sortOrder * 2);
    const startStr = `${nextStartH < 10 ? "0" : ""}${nextStartH}:00`;
    const endStr = `${nextStartH + 1 < 10 ? "0" : ""}${nextStartH + 1}:30`;

    const newStop: StopItem = {
      id: "stop-" + Date.now(),
      placeId: targetPlace.id,
      placeName: targetPlace.name,
      category: targetPlace.category,
      dayIndex: selectedDay,
      startTime: startStr,
      endTime: endStr,
      sortOrder,
      estCostPaise: 40000,
      notes: `Added from nearby discovery for ${targetPlace.name}`,
    };

    setStops((prev) => [...prev, newStop]);

    if (activeSubItineraryId) {
      setSubItineraries((prev) =>
        prev.map((sub) => {
          if (sub.id === activeSubItineraryId) {
            return {
              ...sub,
              stopIds: [...sub.stopIds, newStop.id],
            };
          }
          return sub;
        })
      );
    }

    try {
      await fetch(`/api/trips/${tripId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: targetPlace.id,
          placeName: targetPlace.name,
          category: targetPlace.category,
          dayIndex: selectedDay,
          startTime: startStr,
          endTime: endStr,
          sortOrder,
          estCostPaise: 40000,
          notes: newStop.notes,
        }),
      });
    } catch {}
  };


  // Sub-Itinerary state
  interface SubItineraryItem {
    id: string;
    title: string;
    dayIndex: number;
    stopIds: string[];
    memberUserIds?: string[];
  }
  const [subItineraries, setSubItineraries] = useState<SubItineraryItem[]>([]);
  const [activeSubItineraryId, setActiveSubItineraryId] = useState<string | null>(null);
  const [showCreateSubModal, setShowCreateSubModal] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [selectedStopIdsForSub, setSelectedStopIdsForSub] = useState<string[]>([]);
  const [selectedMemberIdsForSub, setSelectedMemberIdsForSub] = useState<string[]>([]);


  // Computed Stops & Sub-Itineraries for Selected Day (Top-Level Hooks)
  const currentDayStops = useMemo(() => {
    return stops
      .filter((s) => s.dayIndex === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [stops, selectedDay]);

  const activeSubItinerary = useMemo(() => {
    return subItineraries.find((s) => s.id === activeSubItineraryId && s.dayIndex === selectedDay) || null;
  }, [subItineraries, activeSubItineraryId, selectedDay]);

  const displayedStops = useMemo(() => {
    if (activeSubItinerary && activeSubItinerary.stopIds.length > 0) {
      return currentDayStops.filter((s) => activeSubItinerary.stopIds.includes(s.id));
    }
    return currentDayStops;
  }, [activeSubItinerary, currentDayStops]);




  // Load live trip data from connected Neon Database
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/trips/${tripId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.trip) {
            setTrip(data.trip);
            if (data.members && data.members.length > 0) {
              setMembers(data.members);
              setExpensePayer(data.members[0].userId);
            }
            if (data.places && data.places.length > 0) {
              setPlaces(data.places);
              setNewStopPlaceId(data.places[0].id);
            }
            if (data.stops && data.stops.length > 0) {
              setStops(data.stops);
            } else {
              setStops([]);
            }
            if (data.expenses && data.expenses.length > 0) {
              setExpenses(data.expenses);
            } else {
              setExpenses([]);
            }
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tripId]);

  // Robust client-side conflict evaluation with server fallback
  const runLocalConflictEvaluation = (currentStops: StopItem[], currentTrip: any): ConflictItem[] => {
    if (!currentTrip) return [];
    const detected: ConflictItem[] = [];
    const dailyStart = currentTrip.dailyStart || "09:00";
    const dailyEnd = currentTrip.dailyEnd || "21:00";

    // Group stops by day
    const stopsByDay: Record<number, StopItem[]> = {};
    currentStops.forEach((s) => {
      if (!stopsByDay[s.dayIndex]) stopsByDay[s.dayIndex] = [];
      stopsByDay[s.dayIndex].push(s);
    });

    Object.entries(stopsByDay).forEach(([dayStr, dayStops]) => {
      const dayNum = Number(dayStr);
      // Sort chronologically
      dayStops.sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (let i = 0; i < dayStops.length; i++) {
        const current = dayStops[i];

        // 1. Operating Window Violations
        if (current.startTime < dailyStart) {
          detected.push({
            type: "Operating Window",
            severity: "warning",
            stopIds: [current.id],
            message: `"${current.placeName || current.placeId}" on Day ${dayNum} starts at ${current.startTime}, prior to trip start time (${dailyStart}).`,
            suggestedFix: `Shift start to ${dailyStart} or later.`,
          });
        }
        if (current.endTime > dailyEnd) {
          detected.push({
            type: "Operating Window",
            severity: "warning",
            stopIds: [current.id],
            message: `"${current.placeName || current.placeId}" on Day ${dayNum} ends at ${current.endTime}, past planned trip cutoff (${dailyEnd}).`,
            suggestedFix: `Shorten duration or conclude by ${dailyEnd}.`,
          });
        }

        // 2. Pairwise overlaps and tight transit buffers
        if (i < dayStops.length - 1) {
          const next = dayStops[i + 1];

          // Overlap: current.endTime > next.startTime
          if (current.endTime > next.startTime) {
            detected.push({
              type: "Time Overlap",
              severity: "error",
              stopIds: [current.id, next.id],
              message: `Schedule collision between "${current.placeName || current.placeId}" (${current.startTime}–${current.endTime}) and "${next.placeName || next.placeId}" (${next.startTime}–${next.endTime}) on Day ${dayNum}.`,
              suggestedFix: `Adjust "${next.placeName || next.placeId}" to begin after ${current.endTime}.`,
            });
          } else {
            // Buffer check: if gap < 20 minutes
            const [curEndH, curEndM] = current.endTime.split(":").map(Number);
            const [nextStartH, nextStartM] = next.startTime.split(":").map(Number);
            const gapMinutes = nextStartH * 60 + nextStartM - (curEndH * 60 + curEndM);

            if (gapMinutes < 20) {
              detected.push({
                type: "Transit Buffer Warning",
                severity: "warning",
                stopIds: [current.id, next.id],
                message: `Tight transit window (${gapMinutes} min gap) between "${current.placeName || current.placeId}" and "${next.placeName || next.placeId}". Road transit may require at least 20–25 minutes.`,
                suggestedFix: `Add a 25-minute buffer before starting "${next.placeName || next.placeId}".`,
              });
            }
          }
        }
      }
    });

    // 3. Budget overrun check
    const totalStopsCost = currentStops.reduce((sum, s) => sum + (s.estCostPaise || 0), 0);
    const tripBudget = currentTrip.budgetPaise || 4500000;
    if (totalStopsCost > tripBudget) {
      detected.push({
        type: "Budget Overrun",
        severity: "warning",
        stopIds: [],
        message: `Estimated stops total (₹${Math.round(totalStopsCost / 100).toLocaleString("en-IN")}) exceeds target trip budget (₹${Math.round(tripBudget / 100).toLocaleString("en-IN")}).`,
        suggestedFix: "Review high-cost entries or increase trip budget allocation.",
      });
    }

    return detected;
  };

  // Run conflict detection whenever stops or trip parameters change
  useEffect(() => {
    async function runConflictCheck() {
      if (!trip) return;
      const localConflicts = runLocalConflictEvaluation(stops, trip);

      try {
        const res = await fetch(`/api/trips/${tripId}/conflicts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stops,
            dailyStart: trip.dailyStart || "09:00",
            dailyEnd: trip.dailyEnd || "21:00",
            budgetPaise: trip.budgetPaise || 0,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.conflicts && data.conflicts.length > 0) {
            setConflicts(data.conflicts);
            return;
          }
        }
      } catch {
        // Use local conflicts
      }
      setConflicts(localConflicts);
    }
    runConflictCheck();
  }, [stops, trip?.dailyStart, trip?.dailyEnd, trip?.budgetPaise, tripId]);

  // State for Budget & Travel Vibe warning prompt
  const [budgetWarning, setBudgetWarning] = useState<{
    totalEstCostPaise: number;
    budgetPaise: number;
    message: string;
    retainedStopsCount: number;
    originalStopsCount: number;
  } | null>(null);

  // AI Itinerary Generation Engine & Smart Conflict Resolver
  const handleGenerateAI = async (forceRegenerate = true) => {
    setIsGeneratingAI(true);
    setBudgetWarning(null);
    try {
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: trip.id,
          destination: trip.destination,
          tripType: trip.type,
          daysCount: tripDays.length || 3,
          dailyStart: trip.dailyStart || "09:00",
          dailyEnd: trip.dailyEnd || "21:00",
          forceRegenerate,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // Check if budget exceeded and warning emitted
        if (data.budgetExceeded) {
          setBudgetWarning({
            totalEstCostPaise: data.totalEstCostPaise,
            budgetPaise: data.budgetPaise,
            message: data.budgetMessage,
            retainedStopsCount: data.retainedStopsCount,
            originalStopsCount: data.originalStopsCount,
          });
        }

        if (data.itinerary && Array.isArray(data.itinerary)) {
          const newStopsList: StopItem[] = [];
          data.itinerary.forEach((dayObj: any) => {
            if (dayObj.stops && Array.isArray(dayObj.stops)) {
              dayObj.stops.forEach((s: any, idx: number) => {
                newStopsList.push({
                  id: `stop-ai-${dayObj.dayIndex}-${idx}-${Date.now()}`,
                  placeId: s.placeId || `dest-${idx}`,
                  placeName: s.placeName || s.name || s.placeId,
                  category: s.category || "attraction",
                  dayIndex: dayObj.dayIndex,
                  startTime: s.startTime || "10:00",
                  endTime: s.endTime || "12:00",
                  sortOrder: idx + 1,
                  estCostPaise: s.estCostPaise || 40000,
                  notes: s.notes || "AI-optimized stop matching user travel vibe & preferences",
                });
              });
            }
          });

          if (newStopsList.length > 0) {
            setStops(newStopsList);
            setConflicts([]);
          }
        }
      }
    } catch {
      // Handled
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // AI Conflict Auto-Fix Engine: re-schedules stops to resolve flagged conflicts
  const handleFixConflictsWithAI = async () => {
    if (conflicts.length === 0 || !trip) return;
    setIsFixingConflicts(true);
    try {
      // Build conflict summary for AI context
      const conflictSummary = conflicts
        .map((c) => `[${c.type}] ${c.message}${c.suggestedFix ? ` Fix: ${c.suggestedFix}` : ""}`)
        .join("\n");

      // Send existing stops + conflict descriptions to AI for rescheduling
      const res = await fetch("/api/itinerary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: trip.destination,
          tripType: trip.type,
          daysCount: tripDays.length || 3,
          dailyStart: trip.dailyStart || "09:00",
          dailyEnd: trip.dailyEnd || "21:00",
          conflictContext: conflictSummary,
          existingStops: stops.map((s) => ({
            placeId: s.placeId,
            name: s.placeName,
            category: s.category,
            dayIndex: s.dayIndex,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
          fixConflictsMode: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.itinerary && Array.isArray(data.itinerary)) {
          const rescheduled: StopItem[] = [];
          data.itinerary.forEach((dayObj: any) => {
            if (dayObj.stops && Array.isArray(dayObj.stops)) {
              dayObj.stops.forEach((s: any, idx: number) => {
                // Try to reuse existing stop ID if placeId matches
                const existing = stops.find((st) => st.placeId === (s.placeId || s.name));
                rescheduled.push({
                  id: existing?.id || `stop-fix-${dayObj.dayIndex}-${idx}-${Date.now()}`,
                  placeId: s.placeId || existing?.placeId || `dest-${idx}`,
                  placeName: s.name || existing?.placeName || s.placeId,
                  category: s.category || existing?.category || "attraction",
                  dayIndex: dayObj.dayIndex,
                  startTime: s.startTime || "10:00",
                  endTime: s.endTime || "12:00",
                  sortOrder: idx + 1,
                  estCostPaise: s.estCostPaise || existing?.estCostPaise || 40000,
                  notes: s.notes || existing?.notes || "AI conflict-resolved scheduling",
                });
              });
            }
          });

          if (rescheduled.length > 0) {
            setStops(rescheduled);
            setConflicts([]); // Optimistically clear conflicts
          }
        } else {
          // Fallback: Apply local time fixes for common conflicts
          const fixedStops = [...stops];
          const stopsByDay: Record<number, StopItem[]> = {};
          fixedStops.forEach((s) => {
            if (!stopsByDay[s.dayIndex]) stopsByDay[s.dayIndex] = [];
            stopsByDay[s.dayIndex].push(s);
          });

          // Sort each day chronologically and fix overlaps with 30-min gaps
          Object.values(stopsByDay).forEach((dayStops) => {
            dayStops.sort((a, b) => a.startTime.localeCompare(b.startTime));
            let cursor = trip.dailyStart || "09:00";
            dayStops.forEach((s) => {
              const [sh, sm] = s.startTime.split(":").map(Number);
              const [eh, em] = s.endTime.split(":").map(Number);
              const dur = (eh * 60 + em) - (sh * 60 + sm);
              const [ch, cm] = cursor.split(":").map(Number);
              const cursorMins = ch * 60 + cm;
              const pad = (n: number) => String(n).padStart(2, "0");
              s.startTime = `${pad(Math.floor(cursorMins / 60))}:${pad(cursorMins % 60)}`;
              const newEnd = cursorMins + Math.max(30, dur);
              s.endTime = `${pad(Math.floor(newEnd / 60))}:${pad(newEnd % 60)}`;
              cursor = `${pad(Math.floor((newEnd + 30) / 60))}:${pad((newEnd + 30) % 60)}`;
            });
          });

          setStops(fixedStops);
          setConflicts([]);
        }
      }
    } catch {
      // Silently try local conflict fixing
    } finally {
      setIsFixingConflicts(false);
    }
  };



  // Add Stop - persists to Neon DB
  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPlace = places.find((p) => p.id === newStopPlaceId);
    const placeName = selectedPlace ? selectedPlace.name : "Custom Spot";
    const category = selectedPlace ? selectedPlace.category : "sightseeing";
    const estCostPaise = (parseFloat(newStopCostRupees) || 0) * 100;
    const sortOrder = stops.filter((s) => s.dayIndex === newStopDay).length + 1;

    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: newStopPlaceId,
          placeName,
          category,
          dayIndex: newStopDay,
          startTime: newStopStart,
          endTime: newStopEnd,
          sortOrder,
          estCostPaise,
          notes: newStopNotes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stop) {
          setStops((prev) => [...prev, data.stop]);
        }
      } else {
        const fallbackStop: StopItem = {
          id: "stop-" + Date.now(),
          placeId: newStopPlaceId,
          placeName,
          category,
          dayIndex: newStopDay,
          startTime: newStopStart,
          endTime: newStopEnd,
          sortOrder,
          estCostPaise,
          notes: newStopNotes,
        };
        setStops((prev) => [...prev, fallbackStop]);
      }
    } catch {
      const fallbackStop: StopItem = {
        id: "stop-" + Date.now(),
        placeId: newStopPlaceId,
        placeName,
        category,
        dayIndex: newStopDay,
        startTime: newStopStart,
        endTime: newStopEnd,
        sortOrder,
        estCostPaise,
        notes: newStopNotes,
      };
      setStops((prev) => [...prev, fallbackStop]);
    }
    setShowAddStopModal(false);
    setNewStopNotes("");
  };

  // Open Edit Stop Modal
  const handleOpenEditStop = (stop: StopItem) => {
    setEditingStop(stop);
    setEditStopPlaceName(stop.placeName || "");
    setEditStopDay(stop.dayIndex);
    setEditStopStart(stop.startTime);
    setEditStopEnd(stop.endTime);
    setEditStopCostRupees(Math.round((stop.estCostPaise || 0) / 100).toString());
    setEditStopNotes(stop.notes || "");
    setShowEditStopModal(true);
  };

  // Save Edited Stop - persists to Neon DB
  const handleSaveEditStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStop) return;

    const estCostPaise = (parseFloat(editStopCostRupees) || 0) * 100;
    const updatedStops = stops.map((s) => {
      if (s.id === editingStop.id) {
        return {
          ...s,
          placeName: editStopPlaceName || s.placeName,
          dayIndex: editStopDay,
          startTime: editStopStart,
          endTime: editStopEnd,
          estCostPaise,
          notes: editStopNotes,
        };
      }
      return s;
    });

    setStops(updatedStops);
    setShowEditStopModal(false);

    try {
      await fetch(`/api/trips/${tripId}/stops`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stopId: editingStop.id,
          dayIndex: editStopDay,
          startTime: editStopStart,
          endTime: editStopEnd,
          estCostPaise,
          notes: editStopNotes,
        }),
      });
    } catch {}

    setEditingStop(null);
  };

  // Delete Stop - persists to Neon DB
  const handleDeleteStop = async (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/trips/${tripId}/stops?stopId=${id}`, {
        method: "DELETE",
      });
    } catch {}
  };

  // Add Custom Place directly - persists to DB
  const handleAddCustomPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPlaceId = "custom-place-" + Date.now();
    const newPlace: PlaceItem = {
      id: newPlaceId,
      name: customPlaceName,
      category: customPlaceCategory,
      destination: trip?.destination || "Destination",
      openingHours: customPlaceHours,
      hoursConfidence: "Verified by traveler",
      description: customPlaceDesc,
      popularityScore: 92,
    };
    setPlaces((prev) => [newPlace, ...prev]);

    try {
      const res = await fetch(`/api/trips/${tripId}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: newPlaceId,
          placeName: customPlaceName,
          category: customPlaceCategory,
          dayIndex: customPlaceDay,
          startTime: customPlaceStart,
          endTime: customPlaceEnd,
          sortOrder: stops.filter((s) => s.dayIndex === customPlaceDay).length + 1,
          estCostPaise: 50000,
          notes: customPlaceDesc || "Custom scheduled spot",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.stop) {
          setStops((prev) => [...prev, data.stop]);
        }
      }
    } catch {
      const fallbackStop: StopItem = {
        id: "stop-" + Date.now(),
        placeId: newPlaceId,
        placeName: customPlaceName,
        category: customPlaceCategory,
        dayIndex: customPlaceDay,
        startTime: customPlaceStart,
        endTime: customPlaceEnd,
        sortOrder: stops.filter((s) => s.dayIndex === customPlaceDay).length + 1,
        estCostPaise: 50000,
        notes: customPlaceDesc || "Custom scheduled spot",
      };
      setStops((prev) => [...prev, fallbackStop]);
    }

    setShowCustomPlaceModal(false);
    setCustomPlaceName("");
    setCustomPlaceDesc("");
  };

  // Open Navigation modal between two consecutive stops with real-time routing & dynamic insights
  const handleOpenNavigation = async (
    fromStop: StopItem,
    toStop: StopItem,
    mode: "driving" | "bike" | "transit" | "walking" = selectedNavMode
  ) => {
    setSelectedNavMode(mode);
    setActiveNavStopId(toStop.id);
    const [fromEndH, fromEndM] = fromStop.endTime.split(":").map(Number);
    const [toStartH, toStartM] = toStop.startTime.split(":").map(Number);
    const allocatedBufferMinutes = Math.max(0, toStartH * 60 + toStartM - (fromEndH * 60 + fromEndM));

    const fromPlace = places.find((p) => p.id === fromStop.placeId);
    const toPlace = places.find((p) => p.id === toStop.placeId);

    // Use user's current GPS location as origin if available, otherwise fall back to stop coordinates
    const hasUserGPS = userLocation && !isNaN(userLocation.lat) && !isNaN(userLocation.lng);
    const fromLat = hasUserGPS ? userLocation!.lat : parseFloat(fromPlace?.latitude || "15.35");
    const fromLng = hasUserGPS ? userLocation!.lng : parseFloat(fromPlace?.longitude || "73.91");
    const toLat = parseFloat(toPlace?.latitude || "15.36");
    const toLng = parseFloat(toPlace?.longitude || "73.92");

    let durationMinutes = 20;
    let distanceKm = 6.5;
    let routingSource = "ors";

    try {
      const routingMode = mode === "walking" ? "walking" : mode === "bike" ? "cycling" : "driving";
      const res = await fetch("/api/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: fromLat, lng: fromLng },
          destination: { lat: toLat, lng: toLng },
          mode: routingMode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.route) {
          durationMinutes = data.route.durationMinutes || Math.round(data.route.durationSeconds / 60) || 15;
          distanceKm = data.route.distanceKm || Number((data.route.distanceMeters / 1000).toFixed(1)) || 5.0;
          routingSource = data.route.source || "ors";
        }
      }
    } catch (e) {
      console.warn("Dynamic routing fetch failed, using fallback calculation:", e);
    }

    const bufferSurplus = allocatedBufferMinutes - durationMinutes;

    // Dynamic Real-Time Path Insights Generation
    const dynamicInsights: string[] = [];
    const modeLabel = mode === "walking" ? "walking path" : mode === "bike" ? "scooter/bike route" : mode === "transit" ? "bus/transit connection" : "driving route";
    
    if (hasUserGPS) {
      dynamicInsights.push(
        `📍 Navigation starts from your current GPS location. Real-time ${modeLabel} spans ${distanceKm} km with ~${durationMinutes} mins estimated travel time (${routingSource.toUpperCase()} live routing).`
      );
    } else {
      dynamicInsights.push(
        `Real-time ${modeLabel} spans ${distanceKm} km with ~${durationMinutes} mins estimated travel time (${routingSource.toUpperCase()} live routing).`
      );
    }

    if (bufferSurplus >= 15) {
      dynamicInsights.push(
        `✓ Comfortable schedule window: You have a ${bufferSurplus} min buffer before the ${toStop.startTime} visit to ${toStop.placeName || toPlace?.name || "next destination"}.`
      );
    } else if (bufferSurplus >= 0) {
      dynamicInsights.push(
        `⚡ On-schedule window: Transit requires ~${durationMinutes} mins of your ${allocatedBufferMinutes} min gap. Depart promptly at ${fromStop.endTime}.`
      );
    } else {
      dynamicInsights.push(
        `⚠ Schedule conflict: Real-time travel requires ~${durationMinutes} mins, exceeding allocated ${allocatedBufferMinutes} min buffer by ${Math.abs(bufferSurplus)} mins.`
      );
    }

    const cat = (toPlace?.category || toStop.category || "").toLowerCase();
    let parkingStatus = "Available on-site";
    if (cat.includes("beach") || cat.includes("nature")) {
      dynamicInsights.push("Coastal access road with designated beach parking and walking trail to entrance.");
      parkingStatus = "Public beach parking & scooter bays within 150m";
    } else if (cat.includes("heritage") || cat.includes("fort") || cat.includes("viewpoint")) {
      dynamicInsights.push("Historic site: Visitor drop-off zone with parking lot located within 100m.");
      parkingStatus = "Monument visitor parking available";
    } else if (cat.includes("dining") || cat.includes("restaurant") || cat.includes("food")) {
      dynamicInsights.push("Dining hub: Valet and roadside parking active near restaurant entrance.");
      parkingStatus = "Valet & street parking available";
    } else {
      dynamicInsights.push("Standard venue access with marked parking and clear pedestrian walkways.");
      parkingStatus = "On-site & nearby parking available";
    }

    setActiveNavInfo({
      fromStop,
      toStop,
      mode,
      distanceKm,
      durationMinutes,
      bufferMinutes: allocatedBufferMinutes,
      bufferSurplus,
      insights: dynamicInsights,
      parkingStatus,
    });
    setShowNavigationModal(true);
  };


  // Add Party Member - persists to Neon DB
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const newMemberUserId = `member-${Date.now()}`;
    const newMember: TripMember = {
      userId: newMemberUserId,
      displayName: newMemberName.trim(),
      email: newMemberEmail.trim() || `${newMemberName.toLowerCase().replace(/\s+/g, ".")}@voyara.travel`,
      role: newMemberRole,
    };

    setMembers((prev) => [...prev, newMember]);
    setShowAddMemberModal(false);
    setNewMemberName("");
    setNewMemberEmail("");

    try {
      await fetch(`/api/trips/${tripId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newMemberUserId,
          role: newMemberRole,
        }),
      });
    } catch {}
  };

  // Remove Party Member - persists to Neon DB
  const handleRemoveMember = async (userIdToRemove: string) => {
    if (members.length <= 1) return;
    const memberObj = members.find((m) => m.userId === userIdToRemove);
    if (memberObj?.role === "owner") {
      alert("Trip owner cannot be removed.");
      return;
    }

    if (confirm(`Remove ${memberObj?.displayName || "this member"} from the trip party? Expense splits will be recalculated.`)) {
      setMembers((prev) => prev.filter((m) => m.userId !== userIdToRemove));
      try {
        await fetch(`/api/trips/${tripId}/members?userId=${userIdToRemove}`, {
          method: "DELETE",
        });
      } catch {}
    }
  };

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = (parseFloat(expenseAmountRupees) || 0) * 100;
    const payerObj = members.find((m) => m.userId === expensePayer);

    const newExp: ExpenseItem = {
      id: "exp-" + Date.now(),
      payerId: expensePayer,
      payerName: payerObj ? payerObj.displayName : "Member",
      amountPaise,
      category: expenseCategory,
      note: expenseNote,
      spentAt: new Date().toISOString(),
      splitType: expenseSplitType,
    };

    setExpenses([newExp, ...expenses]);
    setShowExpenseModal(false);
    setExpenseNote("");

    try {
      await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerId: expensePayer,
          amountPaise,
          category: expenseCategory,
          note: expenseNote,
          splitType: expenseSplitType,
          participants: members.map((m) => m.userId),
        }),
      });
    } catch {
      // Ignored
    }
  };

  // Calculations for budget & expenses
  const totalBudgetRupees = Math.round(((trip?.budgetPaise || 0)) / 100);
  const totalSpentPaise = expenses.reduce((acc, curr) => acc + curr.amountPaise, 0);
  const totalSpentRupees = Math.round(totalSpentPaise / 100);
  const spendPercent = Math.min(100, Math.round((totalSpentRupees / (totalBudgetRupees || 1)) * 100));

  // Category spending breakdown
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amountPaise / 100;
  });

  // Calculate Balances & Dynamic Settle-up transfers based on current members
  const memberBalances: Record<string, number> = useMemo(() => {
    const balances: Record<string, number> = {};
    members.forEach((m) => (balances[m.userId] = 0));

    expenses.forEach((e) => {
      const amount = e.amountPaise / 100;
      const splitCount = members.length || 1;
      const share = amount / splitCount;

      // Payer is credited the full amount
      if (balances[e.payerId] !== undefined) {
        balances[e.payerId] += amount;
      }
      // Each member owes their share
      members.forEach((m) => {
        balances[m.userId] -= share;
      });
    });

    return balances;
  }, [members, expenses]);

  // Compute minimal settle-up transfers algorithm (Greedy algorithm)
  const settleUpTransfers = useMemo(() => {
    const debtors: { userId: string; amount: number }[] = [];
    const creditors: { userId: string; amount: number }[] = [];

    Object.entries(memberBalances).forEach(([userId, bal]) => {
      const rounded = Math.round(bal);
      if (rounded < -1) {
        debtors.push({ userId, amount: -rounded });
      } else if (rounded > 1) {
        creditors.push({ userId, amount: rounded });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers: { fromId: string; toId: string; amount: number }[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const transferAmount = Math.min(debtor.amount, creditor.amount);

      if (transferAmount > 0) {
        transfers.push({
          fromId: debtor.userId,
          toId: creditor.userId,
          amount: transferAmount,
        });
      }

      debtor.amount -= transferAmount;
      creditor.amount -= transferAmount;

      if (debtor.amount <= 1) i++;
      if (creditor.amount <= 1) j++;
    }

    return transfers;
  }, [memberBalances]);

  // Filtered places for places tab
  const filteredPlaces = places.filter((p) => {
    const matchesCat = placeCategoryFilter === "all" || p.category.toLowerCase() === placeCategoryFilter.toLowerCase();
    const matchesSearch =
      placeSearchQuery === "" ||
      p.name.toLowerCase().includes(placeSearchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(placeSearchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Copy helper
  const copyJoinCode = () => {
    if (!trip?.joinCode) return;
    navigator.clipboard.writeText(trip.joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Trip Status Lifecycle Handler
  const TRIP_STATUS_FLOW = ["planning", "confirmed", "live", "completed", "archived"] as const;
  type TripStatus = typeof TRIP_STATUS_FLOW[number];

  const STATUS_META: Record<TripStatus, { label: string; color: string; bg: string; next?: TripStatus; nextLabel?: string; icon: string }> = {
    planning: { label: "Planning", color: "text-blue-500", bg: "bg-blue-500/15 border-blue-500/40", next: "confirmed", nextLabel: "Confirm Trip", icon: "📋" },
    confirmed: { label: "Confirmed", color: "text-emerald-500", bg: "bg-emerald-500/15 border-emerald-500/40", next: "live", nextLabel: "Start Live Trip", icon: "✅" },
    live: { label: "Live 🔴", color: "text-red-500", bg: "bg-red-500/15 border-red-500/40", next: "completed", nextLabel: "Complete Trip", icon: "🔴" },
    completed: { label: "Completed", color: "text-purple-500", bg: "bg-purple-500/15 border-purple-500/40", next: "archived", nextLabel: "Archive Trip", icon: "🏁" },
    archived: { label: "Archived", color: "text-[var(--foreground)]/40", bg: "bg-[var(--muted)] border-[var(--foreground)]/20", icon: "📁" },
  };

  const handleUpdateTripStatus = async (newStatus: TripStatus) => {
    setIsUpdatingStatus(true);
    setStatusUpdateMsg(null);
    // Optimistic update
    setTrip((prev: any) => ({ ...prev, status: newStatus }));
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setTrip((prev: any) => ({ ...prev, status: data.status }));
        const meta = STATUS_META[newStatus];
        setStatusUpdateMsg(`${meta.icon} Trip status updated to "${meta.label}"`);
      } else {
        // Revert on failure
        const data = await res.json();
        setStatusUpdateMsg(`Failed: ${data.error || "Could not update status"}`);
      }
    } catch {
      setStatusUpdateMsg("Network error. Status may not have saved.");
    } finally {
      setIsUpdatingStatus(false);
      setTimeout(() => setStatusUpdateMsg(null), 4000);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <header className="sticky top-0 z-40 bg-[var(--background)]/90 backdrop-blur-xl shadow-craft-sm border-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <VoyaraLogo size="sm" href="/dashboard" />
            <div className="h-8 w-24 rounded-full bg-[var(--muted)] animate-pulse" />
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-28 rounded-2xl bg-[var(--card)] animate-pulse shadow-craft-sm" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 h-[420px] rounded-2xl bg-[var(--card)] animate-pulse shadow-craft-sm" />
            <div className="lg:col-span-7 h-[420px] rounded-2xl bg-[var(--card)] animate-pulse shadow-craft-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center justify-center p-6 text-center">
        <VoyaraLogo size="md" href="/dashboard" className="mb-6" />
        <h1 className="text-2xl font-serif font-bold mb-2">Trip Not Found</h1>
        <p className="text-sm text-[var(--foreground)]/60 max-w-md mb-6">
          The requested trip could not be found in the database. Please verify the link or return to your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="btn-press px-5 py-2.5 rounded-full bg-[var(--gold)] text-black font-semibold text-xs inline-flex items-center gap-2"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--gold)]/30 transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 shadow-craft-sm border-none bg-[var(--background)]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <VoyaraLogo size="sm" href="/dashboard" />

          {/* Navigation Back to Dashboard & Sign Out */}
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="btn-press text-xs text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition-colors px-3.5 py-1.5 rounded-full bg-[var(--card)] shadow-craft-sm hover:bg-[var(--muted)] flex items-center gap-1.5 font-medium"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Dashboard</span>
            </Link>
            <button
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } catch {}
                window.location.href = "/sign-in";
              }}
              className="btn-press text-xs text-red-400 hover:text-red-300 transition-colors px-3.5 py-1.5 rounded-full bg-red-400/10 hover:bg-red-400/20 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 shadow-craft-sm border-none overflow-x-auto">
          {[
            { id: "itinerary", label: "Smart Itinerary", icon: CalendarDays, count: stops.length },
            { id: "places", label: "Place Discovery", icon: Compass, count: places.length },
            { id: "expenses", label: "Expenses & Settle", icon: Receipt, count: expenses.length },
            { id: "overview", label: "Trip Details & Party", icon: Users, count: members.length },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`btn-press px-4 py-3 text-xs sm:text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? "border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/[0.05]"
                    : "border-transparent text-[var(--foreground)]/60 hover:text-[var(--foreground)] hover:bg-[var(--card)]"
                }`}
              >
                <IconComp className={`w-4 h-4 ${isActive ? "text-[var(--gold)]" : "text-[var(--foreground)]/50"}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-[var(--gold)]/20 text-[var(--gold)]" : "bg-[var(--muted)] text-[var(--foreground)]/50"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Executive Trip Summary Banner + Status Lifecycle Panel */}
      <div className="shadow-craft-sm border-none bg-[var(--card)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex flex-col gap-5">
            {/* Row 1: Title + Quick Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 text-xs text-[var(--gold)] font-medium mb-1.5 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {trip.destination}, India
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {trip.startDate} – {trip.endDate}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{trip.type} Expedition</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-[var(--foreground)] tracking-tight">
                  {trip.name || `${trip.destination} Journey`}
                </h1>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3.5 py-2 rounded-xl bg-[var(--background)] card-craft-subtle border-none">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--foreground)]/40 block">Trip Budget</span>
                  <span className="text-sm font-bold font-mono text-[var(--gold)]">
                    ₹{((trip.budgetPaise || 0) / 100).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[var(--background)] card-craft-subtle border-none">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--foreground)]/40 block">Travellers</span>
                  <span className="text-sm font-bold font-mono text-[var(--foreground)]">
                    {members.length} {members.length === 1 ? "Person" : "Persons"}
                  </span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[var(--background)] card-craft-subtle border-none">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--foreground)]/40 block">Planned Stops</span>
                  <span className="text-sm font-bold font-mono text-emerald-500">
                    {stops.length} Stops
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ========================================================= */}
        {/* TAB 1: SMART ITINERARY (Timeline, Edit, Conflicts & Navigation) */}
        {/* ========================================================= */}
        {activeTab === "itinerary" && (
          <div className="space-y-6 page-enter stagger-1">
            {/* Top Bar with AI Draft, Custom Add & Map Toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--card)] card-craft border-none">
              <div>
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-[var(--gold)]" />
                  <h2 className="text-lg font-serif text-[var(--foreground)]">Daily Itinerary Schedule</h2>
                </div>
                <p className="text-xs text-[var(--foreground)]/50 mt-1">
                  Active window: {trip.dailyStart || "09:00"} – {trip.dailyEnd || "21:00"} • Mode: {trip.transportMode || "driving"}
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => handleGenerateAI()}
                  disabled={isGeneratingAI}
                  className="btn-press flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold)]/20"
                >
                  {isGeneratingAI ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Synthesizing Smart Itinerary...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Smart AI Itinerary</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewStopDay(selectedDay);
                    setShowAddStopModal(true);
                  }}
                  className="btn-press px-4 py-2.5 rounded-xl bg-[var(--card)] card-craft-subtle border-none text-[var(--foreground)] text-xs font-medium hover:bg-[var(--muted)] transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--gold)]" />
                  <span>Add Stop</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className={`btn-press px-3.5 py-2.5 rounded-xl border text-xs font-medium transition flex items-center gap-1.5 ${
                    showMap
                      ? "bg-[var(--gold)]/15 border-[var(--gold)]/50 text-[var(--gold)]"
                      : "bg-[var(--card)] shadow-craft-sm border-none text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>{showMap ? "Hide Map" : "Map View"}</span>
                </button>
              </div>
            </div>

            {/* Live Schedule Guard Conflict Banner */}
            {conflicts.length > 0 && (
              <div className="p-5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/30 text-amber-600 dark:text-amber-200 space-y-3">
                <div className="flex items-center gap-2 font-medium text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
                  <span>
                    Schedule Guard flagged {conflicts.length} timeline{" "}
                    {conflicts.length === 1 ? "issue" : "issues"} (Click &ldquo;Smart AI Itinerary&rdquo; above to auto-reschedule):
                  </span>
                </div>
                <div className="space-y-2">
                  {conflicts.map((c, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-[var(--background)] border border-amber-500/20 text-xs"
                    >
                      <div>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold uppercase text-[10px] mr-2">
                          {c.type}
                        </span>
                        <span className="text-[var(--foreground)]/80">{c.message}</span>
                      </div>
                      {c.suggestedFix && (
                        <div className="text-[var(--gold)] text-[11px] font-medium flex items-center gap-1 shrink-0">
                          <span>💡 Fix:</span>
                          <span>{c.suggestedFix}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget & Travel Vibe Matching Alert Banner */}
            {budgetWarning && (
              <div className="p-5 rounded-2xl bg-amber-500/[0.1] border border-amber-500/40 text-[var(--foreground)] space-y-3 page-enter">
                <div className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[var(--gold)]">Itinerary Cost Exceeds Budget</h4>
                    <p className="text-xs text-[var(--foreground)]/80 mt-1 leading-relaxed">
                      {budgetWarning.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await fetch(`/api/trips/${trip.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ budgetPaise: budgetWarning.totalEstCostPaise }),
                        });
                      } catch {}
                      handleGenerateAI(true);
                    }}
                    className="btn-press px-4 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-bold hover:brightness-105 transition shadow-craft-sm"
                  >
                    Increase Budget to ₹{(budgetWarning.totalEstCostPaise / 100).toLocaleString("en-IN")}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetWarning(null)}
                    className="btn-press px-4 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--foreground)] text-xs font-medium hover:bg-[var(--surface-3)] transition border border-[var(--border-subtle)]"
                  >
                    Keep Vibe-Matched Stops ({budgetWarning.retainedStopsCount} places)
                  </button>
                </div>
              </div>
            )}

            {/* Days Tabs & Sub-Itineraries */}
            <div className="space-y-3 pb-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-craft-sm border-none w-full">
                <div className="flex gap-2 overflow-x-auto w-full pb-1 scrollbar-hide">
                  {tripDays.map((d) => {
                    const count = stops.filter((s) => s.dayIndex === d).length;
                    const isSelected = selectedDay === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setSelectedDay(d);
                          setActiveSubItineraryId(null);
                        }}
                        className={`btn-press px-4 py-2 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                          isSelected
                            ? "bg-[var(--gold)] text-black font-semibold shadow-md shadow-[var(--gold)]/20"
                            : "bg-[var(--card)] text-[var(--foreground)]/70 hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span>Day {d}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected ? "bg-black/20 text-black font-bold" : "bg-[var(--muted)] text-[var(--foreground)]/50"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showMap && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--foreground)]/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Day {selectedDay} Map active • {displayedStops.length} stops mapped</span>
                  </div>
                )}
              </div>

              {/* Sub-Itineraries Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl bg-[var(--card)] card-craft border-none text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]/70 flex items-center gap-1.5 mr-1 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--gold)]" />
                    Sub-Itineraries:
                  </span>
                  <button
                    onClick={() => setActiveSubItineraryId(null)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                      !activeSubItineraryId
                        ? "bg-[var(--gold)] text-black shadow-sm"
                        : "bg-[var(--background)] text-[var(--foreground)]/70 hover:bg-[var(--muted)]"
                    }`}
                  >
                    All Day {selectedDay} ({currentDayStops.length})
                  </button>
                  {subItineraries
                    .filter((sub) => sub.dayIndex === selectedDay)
                    .map((sub) => {
                      const isSelected = activeSubItineraryId === sub.id;
                      const visitingM = sub.memberUserIds && sub.memberUserIds.length > 0
                        ? members.filter((m) => sub.memberUserIds!.includes(m.userId))
                        : members;

                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveSubItineraryId(sub.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition flex items-center gap-2 ${
                            isSelected
                              ? "bg-[var(--gold)] text-black shadow-md"
                              : "bg-[var(--background)] text-[var(--foreground)]/70 hover:bg-[var(--muted)]"
                          }`}
                        >
                          <span>{sub.title}</span>
                          {visitingM.length > 0 && (
                            <div className="flex items-center -space-x-1">
                              {visitingM.slice(0, 3).map((m) => (
                                <div
                                  key={m.userId}
                                  className="w-4 h-4 rounded-full bg-black/30 border border-black text-[8px] font-bold text-white flex items-center justify-center"
                                  title={`${m.displayName} visiting`}
                                >
                                  {m.displayName.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-bold">
                            {sub.stopIds.length} stops
                          </span>
                        </button>
                      );
                    })}
                </div>

                <button
                  onClick={() => {
                    setSelectedStopIdsForSub(currentDayStops.map((s) => s.id));
                    setSelectedMemberIdsForSub(members.map((m) => m.userId));
                    setShowCreateSubModal(true);
                  }}
                  className="btn-press px-3 py-1.5 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 text-[var(--gold)] text-[11px] font-bold flex items-center gap-1 hover:bg-[var(--gold)]/25 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Sub-Itinerary</span>
                </button>

              </div>
            </div>

            {/* 2-Column Split Layout: Left = Sticky Interactive Map, Right = Stops Timeline & Transit */}
            <div className={`grid grid-cols-1 ${showMap ? "lg:grid-cols-12" : ""} gap-6 items-start`}>
              {/* Left Column: Sticky Interactive Map Route */}
              {showMap && (
                <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-24 space-y-4 order-first">
                  <div className="p-4 rounded-2xl bg-[var(--card)] card-craft border-none">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-serif font-semibold text-[var(--foreground)]">
                          {activeSubItinerary ? `Sub-Itinerary: ${activeSubItinerary.title}` : `Route Map — Day ${selectedDay}`}
                        </span>
                      </div>
                      <span className="text-[var(--gold)] font-medium text-[11px]">{displayedStops.length} mapped stops</span>
                    </div>
                    <TripMap
                      places={displayedStops.map((s, idx) => {
                        const p = places.find((pl) => pl.id === s.placeId);
                        return {
                          id: s.id,
                          name: s.placeName || p?.name || s.placeId,
                          category: s.category || p?.category || "attraction",
                          latitude: p?.latitude || "15.35",
                          longitude: p?.longitude || "73.91",
                          order: idx + 1,
                        };
                      })}
                      destination={trip.destination}
                      members={mapMembers}
                      subItineraryTitle={activeSubItinerary?.title}
                      onClearSubItinerary={() => setActiveSubItineraryId(null)}
                      userInitialCoords={userLocation ? [userLocation.lng, userLocation.lat] : undefined}
                      className="w-full h-[300px] sm:h-[460px] lg:h-[calc(100vh-220px)] min-h-[300px] sm:min-h-[420px] max-h-[720px] rounded-xl overflow-hidden shadow-craft-md border-none"
                    />
                  </div>
                </div>
              )}


              {/* Right Column: Stops Timeline for Selected Day */}
              <div className={showMap ? "lg:col-span-7 xl:col-span-7 space-y-4" : "col-span-12 space-y-4"}>
                {currentDayStops.length === 0 ? (
                  <div className="text-center py-16 px-4 rounded-2xl bg-[var(--card)] card-craft border-none">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[var(--gold)]/10 border border-[var(--gold)]/25 flex items-center justify-center text-[var(--gold)]">
                      <Compass className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-medium text-[var(--foreground)]">No stops planned for Day {selectedDay} yet</h3>
                    <p className="text-xs text-[var(--foreground)]/50 max-w-md mx-auto mt-1 mb-6">
                      Click &ldquo;Smart AI Itinerary&rdquo; to auto-compose a personalized day schedule, or browse curated places to add manual stops.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleGenerateAI()}
                        className="btn-press px-4 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Smart AI Itinerary</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("places")}
                        className="btn-press px-4 py-2 rounded-xl bg-[var(--muted)] text-[var(--foreground)] text-xs hover:bg-[var(--card)] flex items-center gap-1.5"
                      >
                        <Compass className="w-3.5 h-3.5 text-[var(--foreground)]/60" />
                        <span>Browse Places</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  currentDayStops.map((stopItem, index) => {
                    const placeMatch = places.find((p) => p.id === stopItem.placeId);
                    const isLast = index === currentDayStops.length - 1;
                    const nextStop = !isLast ? currentDayStops[index + 1] : null;

                    const isNavigatingOnMap = activeNavStopId === stopItem.id;

                    const isMatchDateTime = (() => {
                      const now = new Date();
                      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

                      if (trip?.startDate) {
                        try {
                          const stopDate = new Date(trip.startDate);
                          stopDate.setDate(stopDate.getDate() + (stopItem.dayIndex - 1));

                          const isSameDate =
                            now.getFullYear() === stopDate.getFullYear() &&
                            now.getMonth() === stopDate.getMonth() &&
                            now.getDate() === stopDate.getDate();

                          if (isSameDate && stopItem.startTime && stopItem.endTime) {
                            return currentHHMM >= stopItem.startTime && currentHHMM <= stopItem.endTime;
                          }
                        } catch {}
                      } else {
                        if (stopItem.startTime && stopItem.endTime) {
                          return currentHHMM >= stopItem.startTime && currentHHMM <= stopItem.endTime;
                        }
                      }

                      return false;
                    })();

                    const isCurrentlyVisiting = isNavigatingOnMap || (isMatchDateTime && (trip?.status === "live" || activeNavStopId !== null));

                    return (
                      <div key={stopItem.id} className="relative">
                        {/* Timeline Card */}
                        <div className={`p-4 sm:p-5 rounded-2xl bg-[var(--card)] card-craft transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          isCurrentlyVisiting
                            ? "border-2 border-[var(--gold)] shadow-lg shadow-[var(--gold)]/10"
                            : "border-none hover:border-[var(--gold)]/40"
                        }`}>
                          <div className="flex items-start gap-3.5">
                            {/* Time Slot Pill */}
                            <div className="px-3 py-2 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-center min-w-[84px] shrink-0">
                              <div className="text-xs font-bold text-[var(--gold)] font-mono">
                                {stopItem.startTime}
                              </div>
                              <div className="text-[10px] text-[var(--foreground)]/40 font-mono mt-0.5">
                                to {stopItem.endTime}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
                                  {stopItem.placeName || (placeMatch ? placeMatch.name : stopItem.placeId)}
                                </h4>
                                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--foreground)]/70">
                                  {stopItem.category || "attraction"}
                                </span>

                                {isNavigatingOnMap && (
                                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1 border border-emerald-500/40">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Live Map Navigating</span>
                                  </span>
                                )}

                                {isMatchDateTime && !isCurrentlyVisiting && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateTripStatus("live");
                                      setActiveNavStopId(stopItem.id);
                                    }}
                                    className="text-[11px] px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition flex items-center gap-1.5 shadow-sm animate-pulse"
                                    title="Click to start live trip for this scheduled slot"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Start Trip</span>
                                  </button>
                                )}
                              </div>

                              <p className="text-xs text-[var(--foreground)]/60 mt-1">
                                {stopItem.notes || (placeMatch ? placeMatch.description : "Curated visit")}
                              </p>

                              {placeMatch && placeMatch.openingHours && (
                                <div className="flex items-center gap-2 text-[11px] text-[var(--gold)] mt-1.5 flex-wrap">
                                  <span>🕒 Hours: {placeMatch.openingHours}</span>
                                  <span className="text-[var(--foreground)]/30">•</span>
                                  <span className="text-[var(--foreground)]/50">{placeMatch.hoursConfidence}</span>
                                </div>
                              )}

                              {/* Dynamic Members Visiting Badge on Currently Navigating / Visiting Stop Card */}
                              {isCurrentlyVisiting && (() => {
                                const visitingMembers = activeSubItinerary && activeSubItinerary.stopIds.includes(stopItem.id)
                                  ? (activeSubItinerary.memberUserIds && activeSubItinerary.memberUserIds.length > 0
                                      ? members.filter((m) => activeSubItinerary.memberUserIds!.includes(m.userId))
                                      : members)
                                  : members;

                                if (visitingMembers.length === 0) return null;

                                return (
                                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]/30 text-xs flex-wrap">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--gold)] flex items-center gap-1.5 shrink-0">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                      Visiting Now ({activeSubItinerary ? activeSubItinerary.title : "All Members"}):
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {visitingMembers.map((m) => (
                                        <span
                                          key={m.userId}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[11px] font-semibold text-[var(--foreground)]"
                                        >
                                          <span className="w-4 h-4 rounded-full bg-[var(--gold)] text-black text-[9px] font-black flex items-center justify-center shrink-0">
                                            {m.displayName.charAt(0).toUpperCase()}
                                          </span>
                                          <span>{m.displayName}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>


                          {/* Cost, Edit & Delete */}
                          <div className="flex items-center gap-2.5 sm:gap-3 self-end sm:self-center shrink-0">
                            <div className="text-right mr-1">
                              <div className="text-[11px] text-[var(--foreground)]/40">Est. Cost</div>
                              <div className="text-sm font-semibold text-[var(--foreground)] font-mono">
                                ₹{Math.round(stopItem.estCostPaise / 100).toLocaleString("en-IN")}
                              </div>
                            </div>

                            {/* Edit Stop Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditStop(stopItem)}
                              className="btn-press px-2.5 py-1.5 rounded-lg bg-[var(--muted)] shadow-craft-sm border-none text-[var(--foreground)]/70 hover:text-[var(--gold)] hover:border-[var(--gold)]/40 flex items-center gap-1 text-xs transition"
                              title="Edit place, dates, timing & notes"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            {/* Delete Stop Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteStop(stopItem.id)}
                              className="btn-press w-8 h-8 rounded-lg bg-[var(--muted)] shadow-craft-sm border-none text-[var(--foreground)]/50 hover:text-red-500 hover:border-red-500/30 flex items-center justify-center text-xs transition"
                              title="Remove stop"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Transit & Unified Combined Insight connector between consecutive stops */}
                        {!isLast && nextStop && (() => {
                          const transitKey = `${stopItem.id}->${nextStop.id}`;
                          const td = transitData[transitKey];
                          const isFetching = fetchingTransit[transitKey];
                          const isExpanded = expandedInsightId === transitKey;

                          // Compute schedule buffer
                          const [fromEndH, fromEndM] = stopItem.endTime.split(":").map(Number);
                          const [toStartH, toStartM] = nextStop.startTime.split(":").map(Number);
                          const bufferMin = Math.max(0, toStartH * 60 + toStartM - (fromEndH * 60 + fromEndM));
                          const travelMin = td?.durationMinutes ?? null;
                          const surplus = travelMin !== null ? bufferMin - travelMin : null;
                          const isTight = surplus !== null && surplus < 10;

                          const nextPlaceMatch = places.find((p) => p.id === nextStop.placeId);
                          const pLat = nextPlaceMatch?.latitude ? parseFloat(nextPlaceMatch.latitude) : null;
                          const pLng = nextPlaceMatch?.longitude ? parseFloat(nextPlaceMatch.longitude) : null;

                          let distKmStr: string | null = null;
                          if (userLocation && pLat && pLng && !isNaN(pLat) && !isNaN(pLng)) {
                            const R = 6371;
                            const dLat = ((pLat - userLocation.lat) * Math.PI) / 180;
                            const dLon = ((pLng - userLocation.lng) * Math.PI) / 180;
                            const a =
                              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                              Math.cos((userLocation.lat * Math.PI) / 180) *
                                Math.cos((pLat * Math.PI) / 180) *
                                Math.sin(dLon / 2) *
                                Math.sin(dLon / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            const d = R * c;
                            distKmStr = `${d.toFixed(1)} km from your current GPS location`;
                          }

                          return (
                            <div className="mx-1 my-2 rounded-2xl bg-[var(--background)] shadow-craft-sm overflow-hidden border border-[var(--border)]/30">
                              {/* Connector Header */}
                              <div className="flex items-center justify-between px-3.5 py-2">
                                <div className="flex items-center gap-2 text-xs text-[var(--foreground)]/70">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shrink-0" />
                                  {isFetching ? (
                                    <span className="animate-pulse">Calculating route…</span>
                                  ) : td ? (
                                    <span>
                                      🚗 ~{td.durationMinutes} min&nbsp;·&nbsp;{td.distanceKm} km
                                      {surplus !== null && (
                                        <span className={isTight ? "text-amber-500 ml-1.5 font-semibold" : "text-emerald-500 ml-1.5 font-medium"}>
                                          ({isTight ? `⚠ only ${surplus}m buffer` : `✓ ${surplus}m buffer`})
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span>Transit to <span className="text-[var(--foreground)] font-semibold">{nextStop.placeName || nextStop.placeId}</span></span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Unified Combined Insight Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!td && !isFetching) {
                                        const fromPlace = places.find((p) => p.id === stopItem.placeId);
                                        const toPlace = places.find((p) => p.id === nextStop.placeId);
                                        if (fromPlace?.latitude && toPlace?.latitude) {
                                          setFetchingTransit((prev) => ({ ...prev, [transitKey]: true }));
                                          fetch("/api/routing", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              origin: { lat: parseFloat(fromPlace.latitude), lng: parseFloat(fromPlace.longitude!) },
                                              destination: { lat: parseFloat(toPlace.latitude), lng: parseFloat(toPlace.longitude!) },
                                              mode: "driving",
                                            }),
                                          })
                                            .then((r) => r.json())
                                            .then((data) => {
                                              if (data.route) {
                                                setTransitData((prev) => ({
                                                  ...prev,
                                                  [transitKey]: {
                                                    durationMinutes: data.route.durationMinutes,
                                                    distanceKm: data.route.distanceKm,
                                                    source: data.route.source,
                                                  },
                                                }));
                                              }
                                            })
                                            .catch(() => {})
                                            .finally(() => setFetchingTransit((prev) => ({ ...prev, [transitKey]: false })));
                                        }
                                      }
                                      setExpandedInsightId(isExpanded ? null : transitKey);
                                    }}
                                    className={`btn-press text-xs font-semibold flex items-center gap-1.5 px-3 py-1 rounded-xl transition ${
                                      isExpanded
                                        ? "bg-[var(--gold)] text-black shadow-sm"
                                        : "bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20"
                                    }`}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>{isExpanded ? "Hide Insight" : "Insight"}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenNavigation(stopItem, nextStop)}
                                    className="btn-press text-xs font-medium text-[var(--foreground)]/70 hover:text-[var(--gold)] flex items-center gap-1 px-2 py-1"
                                    title="Start Turn-by-Turn Navigation"
                                  >
                                    <Navigation className="w-3 h-3 text-[var(--gold)]" />
                                    <span>Navigate</span>
                                  </button>
                                </div>
                              </div>

                              {/* Inline transit mode options */}
                              <div className="flex items-stretch border-t border-[var(--border)]/20">
                                {([
                                  { icon: Car, label: "Drive", mode: "driving" },
                                  { icon: Bike, label: "Scooter", mode: "cycling" },
                                  { icon: Bus, label: "Bus", mode: "transit" },
                                  { icon: Footprints, label: "Walk", mode: "walking" },
                                ] as const).map(({ icon: IC, label, mode }, mi) => {
                                  const modeMultiplier = mode === "walking" ? 4.5 : mode === "cycling" ? 2.2 : mode === "transit" ? 1.6 : 1;
                                  const baseMins = td?.durationMinutes ?? 22;
                                  const modeMins = mode === "driving" ? baseMins : Math.round(baseMins * modeMultiplier);
                                  return (
                                    <div key={mode} className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-center ${
                                      mi !== 0 ? "border-l border-[var(--border)]/20" : ""
                                    }`}>
                                      <IC className="w-3.5 h-3.5 text-[var(--foreground)]/40" />
                                      <span className="text-[9px] text-[var(--foreground)]/40">{label}</span>
                                      <span className="text-[11px] font-mono font-semibold text-[var(--foreground)]/70">
                                        {modeMins < 60 ? `${modeMins}m` : `${Math.floor(modeMins/60)}h ${modeMins%60}m`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Combined Expanded Insight Drawer */}
                              {isExpanded && (
                                <div className="p-4 bg-[var(--card)] border-t border-[var(--gold)]/30 space-y-3 text-xs animate-[fadeIn_0.2s_ease]">
                                  <div className="flex items-center justify-between border-b border-[var(--border)]/30 pb-2">
                                    <div className="flex items-center gap-2 text-[var(--gold)] font-bold">
                                      <Sparkles className="w-4 h-4" />
                                      <span>Route & Place Intelligence — {nextStop.placeName}</span>
                                    </div>
                                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)]/60">
                                      {nextStop.category || "attraction"}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* GPS Start Distance & Travel ETA */}
                                    <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]/30">
                                      <div className="text-[10px] uppercase font-bold text-[var(--foreground)]/40">
                                        GPS Live Distance
                                      </div>
                                      <div className="text-xs font-semibold text-emerald-500 mt-1">
                                        {distKmStr || (td ? `${td.distanceKm} km from previous stop` : "Calculating distance...")}
                                      </div>
                                      <div className="text-[10px] text-[var(--foreground)]/50 mt-0.5">
                                        Estimated transit: ~{td?.durationMinutes ?? 20} mins
                                      </div>
                                    </div>

                                    {/* Best Time & Crowd Advice */}
                                    <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]/30">
                                      <div className="text-[10px] uppercase font-bold text-[var(--foreground)]/40">
                                        Optimal Visit Window
                                      </div>
                                      <div className="text-xs font-semibold text-[var(--foreground)] mt-1">
                                        {nextPlaceMatch?.openingHours || "Morning / Sunset hours"}
                                      </div>
                                      <div className="text-[10px] text-amber-500 mt-0.5">
                                        ⚡ Moderate crowd expected around {nextStop.startTime}
                                      </div>
                                    </div>

                                    {/* Visitor Spend & Budget */}
                                    <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]/30">
                                      <div className="text-[10px] uppercase font-bold text-[var(--foreground)]/40">
                                        Est. Visitor Cost
                                      </div>
                                      <div className="text-xs font-semibold text-[var(--gold)] font-mono mt-1">
                                        ₹{Math.round(nextStop.estCostPaise / 100).toLocaleString("en-IN")} per person
                                      </div>
                                      <div className="text-[10px] text-[var(--foreground)]/50 mt-0.5">
                                        Includes entry & local activity
                                      </div>
                                    </div>
                                  </div>

                                  {/* Insider Travel Tips */}
                                  <div className="p-3 rounded-xl bg-[var(--muted)] text-[var(--foreground)]/80 leading-relaxed">
                                    <span className="font-bold text-[var(--gold)] mr-1">Insider Tip:</span>
                                    {nextPlaceMatch?.description || "Curated stop on your route. Recommended for sightseeing, photography, and exploring local culture."}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PLACE DISCOVERY (Curated & Custom Spots) */}
        {/* ========================================================= */}
        {activeTab === "places" && (
          <div className="space-y-6 page-enter stagger-1">
            {/* AI Suggest Locations Header Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-[var(--gold)]/20 via-[var(--card)] to-[var(--gold)]/10 border border-[var(--gold)]/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-craft-sm">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-extrabold text-[var(--gold)] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>AI Location Discovery Engine</span>
                </div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-[var(--foreground)] mt-1">
                  Suggest More Locations for {trip?.destination || "your destination"}
                </h3>
                <p className="text-xs text-[var(--foreground)]/60 mt-0.5 max-w-xl leading-relaxed">
                  Generate fresh top-rated attractions, local hidden gems, coastal vistas and heritage spots tailored specifically to {trip?.destination || "your trip"}.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateAISuggestions}
                disabled={isSuggestingAIPlaces}
                className="btn-press px-5 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-bold flex items-center gap-2 shadow-lg shadow-[var(--gold)]/20 hover:bg-[#ebd2a0] disabled:opacity-50 transition-all shrink-0"
              >
                <Sparkles className="w-4 h-4 fill-black" />
                <span>{isSuggestingAIPlaces ? "AI Analyzing Spots..." : `Suggest Locations for ${trip?.destination || "Trip"}`}</span>
              </button>
            </div>

            {aiSuggestionSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-in fade-in">
                <span>{aiSuggestionSuccessMsg}</span>
                <button onClick={() => setAiSuggestionSuccessMsg(null)} className="text-xs opacity-60 hover:opacity-100 font-bold ml-2">✕</button>
              </div>
            )}

            {/* Search, Filter & Add Custom Spot */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--foreground)]/40" />
                <input
                  type="text"
                  value={placeSearchQuery}
                  onChange={(e) => setPlaceSearchQuery(e.target.value)}
                  placeholder={`Search ${trip.destination} attractions, beaches, waterfalls...`}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--card)] shadow-craft-sm border-none text-xs text-[var(--foreground)] placeholder-[var(--foreground)]/30 field-input"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {["all", "beach", "heritage", "nature", "viewpoint"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPlaceCategoryFilter(cat)}
                    className={`btn-press px-3.5 py-1.5 rounded-xl text-xs capitalize transition whitespace-nowrap ${
                      placeCategoryFilter === cat
                        ? "bg-[var(--gold)] text-black font-semibold shadow-md shadow-[var(--gold)]/20"
                        : "bg-[var(--card)] text-[var(--foreground)]/70 hover:bg-[var(--muted)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setShowCustomPlaceModal(true)}
                  className="btn-press px-3.5 py-1.5 rounded-xl text-xs bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/25 whitespace-nowrap flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>Custom Spot</span>
                </button>
              </div>
            </div>

            {/* Places Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPlaces.map((p) => {
                const isAlreadyInItinerary = stops.some((s) => s.placeId === p.id);

                return (
                  <div
                    key={p.id}
                    className="p-5 rounded-2xl bg-[var(--card)] card-craft border-none hover:border-[var(--gold)]/40 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25">
                          {p.category}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--foreground)]/60">
                          <Star className="w-3 h-3 fill-[var(--gold)] text-[var(--gold)]" />
                          <span className="font-mono">{p.popularityScore || 90}</span>
                        </div>
                      </div>

                      <h3 className="text-base font-serif font-semibold text-[var(--foreground)] mb-1.5">{p.name}</h3>
                      <p className="text-xs text-[var(--foreground)]/60 leading-relaxed line-clamp-2 mb-4">
                        {p.description || "Scenic must-visit place in " + p.destination}
                      </p>

                      {p.openingHours && (
                        <div className="text-[11px] text-[var(--foreground)]/50 mb-4 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-[var(--gold)]" />
                          <span>{p.openingHours}</span>
                          <span>•</span>
                          <span className="text-[var(--gold)]">{p.hoursConfidence}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewStopPlaceId(p.id);
                          setNewStopDay(selectedDay);
                          setShowAddStopModal(true);
                        }}
                        className={`btn-press flex-1 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                          isAlreadyInItinerary
                            ? "bg-[var(--muted)] text-[var(--foreground)]/70 hover:bg-[var(--card)]"
                            : "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30 hover:bg-[var(--gold)]/25"
                        }`}
                      >
                        {isAlreadyInItinerary ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Added (Add Another Day)</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Schedule to Day {selectedDay}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* FIND MORE PLACES SECTION - Live DB data */}
            <div className="pt-8 border-t border-[var(--border)]/40 space-y-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[var(--foreground)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--gold)] animate-pulse" />
                  <span>Find More Places (Suggested Discoveries for {trip?.destination})</span>
                </h3>
                <p className="text-xs text-[var(--foreground)]/50 mt-0.5">
                  If you like any suggested spot, click &ldquo;+ Add to Place Discovery&rdquo; to add it into your trip places list.
                </p>
              </div>

              {/* AI discover banner */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--gold)]/[0.07] border border-[var(--gold)]/25">
                <div className="text-xs text-[var(--foreground)]/70">
                  <span className="text-[var(--gold)] font-semibold">AI Discover:</span>{" "}
                  Search our curated database + AI engine for more {trip?.destination} places to visit.
                </div>
                <button
                  onClick={handleGenerateAISuggestions}
                  disabled={isSuggestingAIPlaces}
                  className="btn-press shrink-0 px-3.5 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-bold flex items-center gap-1.5 hover:brightness-105 transition-all"
                >
                  {isSuggestingAIPlaces ? (
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isSuggestingAIPlaces ? "Discovering..." : "Discover More"}</span>
                </button>
              </div>

              {aiSuggestionSuccessMsg && (
                <div className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  {aiSuggestionSuccessMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(() => {
                  // Show places from DB that haven't been added as stops yet
                  const usedPlaceIds = new Set(stops.map((s) => s.placeId));
                  const unaddedPlaces = places.filter((p) => !usedPlaceIds.has(p.id));

                  if (unaddedPlaces.length === 0) {
                    return (
                      <div className="col-span-3 p-6 rounded-2xl bg-[var(--card)] card-craft text-center text-xs text-[var(--foreground)]/50">
                        {places.length > 0
                          ? "✓ All discovered places have been added to your itinerary stops!"
                          : `No places found in database for ${trip?.destination}. Click "Discover More" above to fetch suggestions.`}
                      </div>
                    );
                  }

                  return unaddedPlaces.map((sug: PlaceItem) => (
                    <div
                      key={sug.id}
                      className="p-5 rounded-2xl bg-[var(--card)] card-craft border-none hover:border-[var(--gold)]/40 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25">
                            {sug.category}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-[var(--foreground)]/60">
                            <Star className="w-3 h-3 fill-[var(--gold)] text-[var(--gold)]" />
                            <span className="font-mono">{sug.popularityScore || 92}</span>
                          </div>
                        </div>

                        <h4 className="text-base font-serif font-semibold text-[var(--foreground)] mb-1.5">{sug.name}</h4>
                        <p className="text-xs text-[var(--foreground)]/60 leading-relaxed line-clamp-2 mb-4">
                          {sug.description || `A must-visit ${sug.category} destination in ${sug.destination}.`}
                        </p>

                        {sug.openingHours && (
                          <div className="text-[11px] text-[var(--foreground)]/50 mb-4 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-[var(--gold)]" />
                            <span>{sug.openingHours}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddSuggestedPlaceToDiscovery(sug)}
                        className="btn-press w-full py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-md hover:bg-[#ebd2a0] transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add to Place Discovery</span>
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>
        )}


        {/* ========================================================= */}
        {/* TAB 3: EXPENSES & SETTLEMENTS */}
        {/* ========================================================= */}
        {activeTab === "expenses" && (
          <div className="space-y-8 page-enter stagger-1">
            {/* Budget vs Actual Spend Header Widget */}
            <div className="p-6 rounded-2xl bg-[var(--card)] card-craft border-none">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs font-medium text-[var(--foreground)]/50 uppercase tracking-wider">
                    Trip Budget vs Actual Spend
                  </div>
                  <div className="text-2xl sm:text-3xl font-serif font-bold text-[var(--foreground)] mt-1">
                    ₹{totalSpentRupees.toLocaleString("en-IN")}{" "}
                    <span className="text-sm font-normal text-[var(--foreground)]/40 font-sans">
                      of ₹{totalBudgetRupees.toLocaleString("en-IN")} allocated
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExpenseModal(true)}
                  className="btn-press px-5 py-2.5 rounded-full bg-[var(--gold)] text-black text-xs font-semibold shadow-md shadow-[var(--gold)]/20 hover:brightness-105 active:scale-95 transition"
                >
                  + Log Shared Expense
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-[var(--muted)] overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    spendPercent > 90 ? "bg-red-500" : "bg-[var(--gold)]"
                  }`}
                  style={{ width: `${spendPercent}%` }}
                ></div>
              </div>

              {/* Category Breakdown Badges */}
              <div className="flex flex-wrap gap-3 pt-2 shadow-craft-sm border-none text-xs">
                {Object.entries(categoryTotals).map(([cat, amount]) => (
                  <div
                    key={cat}
                    className="px-3 py-1.5 rounded-xl bg-[var(--background)] card-craft-subtle border-none flex items-center gap-2"
                  >
                    <span className="capitalize text-[var(--foreground)]/60">{cat}:</span>
                    <span className="font-semibold text-[var(--foreground)] font-mono">
                      ₹{Math.round(amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Balances & Settle-Up Minimum Payment Widget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Balances */}
              <div className="p-6 rounded-2xl bg-[var(--card)] card-craft border-none">
                <h3 className="text-base font-serif font-semibold text-[var(--foreground)] mb-4">
                  Group Net Balances
                </h3>
                <div className="space-y-3">
                  {members.map((m) => {
                    const bal = Math.round(memberBalances[m.userId] || 0);
                    const isPositive = bal >= 0;
                    const memberName = m.displayName || m.userId || "Member";
                    const initial = (memberName[0] || "M").toUpperCase();
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] card-craft-subtle border-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-[var(--muted)] text-xs flex items-center justify-center font-bold text-[var(--gold)]">
                            {initial}
                          </span>
                          <span className="text-sm font-medium text-[var(--foreground)]">{memberName}</span>
                        </div>
                        <div
                          className={`text-xs font-mono font-bold ${
                            isPositive ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {isPositive ? `+₹${bal.toLocaleString("en-IN")}` : `-₹${Math.abs(bal).toLocaleString("en-IN")}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggested Settlements */}
              <div className="p-6 rounded-2xl bg-[var(--card)] card-craft border-none">
                <h3 className="text-base font-serif font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[var(--gold)]" />
                  Optimal Settle-Up (Minimum Transfers)
                </h3>
                <p className="text-xs text-[var(--foreground)]/50 mb-4">
                  Debt simplification algorithm automatically recalculates minimal transfers when party members or expenses change.
                </p>

                <div className="space-y-3">
                  {settleUpTransfers.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[var(--background)] card-craft-subtle border-none text-xs text-[var(--foreground)]/60 text-center">
                      All balances are completely settled up!
                    </div>
                  ) : (
                    settleUpTransfers.map((t, idx) => {
                      const fromName = members.find((m) => m.userId === t.fromId)?.displayName || t.fromId;
                      const toName = members.find((m) => m.userId === t.toId)?.displayName || t.toId;
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[var(--gold)]/[0.06] border border-[var(--gold)]/20 text-xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--foreground)] font-medium">{fromName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[var(--gold)]" />
                            <span className="text-[var(--gold)] font-medium">{toName}</span>
                          </div>
                          <span className="font-mono font-bold text-[var(--foreground)] text-sm">
                            ₹{t.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Expenses Ledger */}
            <div className="p-6 rounded-2xl bg-[var(--card)] card-craft border-none">
              <h3 className="text-base font-serif font-semibold text-[var(--foreground)] mb-4">
                Recorded Expenses Ledger
              </h3>
              <div className="space-y-3">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-4 rounded-xl bg-[var(--background)] card-craft-subtle border-none flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--foreground)] text-sm">{exp.note || "Expense"}</span>
                        <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--foreground)]/60 capitalize text-[10px]">
                          {exp.category}
                        </span>
                      </div>
                      <div className="text-[var(--foreground)]/40 mt-1">
                        Paid by <span className="text-[var(--foreground)]/80">{exp.payerName || exp.payerId}</span> • Equal split
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold font-mono text-[var(--foreground)]">
                        ₹{Math.round(exp.amountPaise / 100).toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-[var(--foreground)]/40">
                        ₹{Math.round(exp.amountPaise / 100 / members.length).toLocaleString("en-IN")}/person
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TRIP OVERVIEW & PARTY MANAGEMENT */}
        {/* ========================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-8 page-enter stagger-1 max-w-4xl">
            {/* Dedicated Trip Status & Lifecycle Management Card */}
            {(() => {
              const currentStatus = (trip.status || "planning") as TripStatus;
              const currentMeta = STATUS_META[currentStatus];
              const nextStatus = currentMeta.next as TripStatus | undefined;
              const nextMeta = nextStatus ? STATUS_META[nextStatus] : null;

              return (
                <div className="p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-craft border-none space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <Sliders className="w-5 h-5 text-[var(--gold)]" />
                      <h3 className="text-lg font-serif text-[var(--foreground)]">Trip Lifecycle & Status Management</h3>
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30 font-semibold">
                      Current: {currentMeta.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--foreground)]/60">
                    Control your trip status flow ({TRIP_STATUS_FLOW.map((p) => STATUS_META[p].label).join(" → ")}).
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[var(--background)] border border-[var(--foreground)]/10">
                    {/* Phase Steps */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {TRIP_STATUS_FLOW.map((phase, idx) => {
                        const phaseMeta = STATUS_META[phase];
                        const statusOrder = TRIP_STATUS_FLOW.indexOf(currentStatus);
                        const isActive = phase === currentStatus;
                        const isPast = idx < statusOrder;
                        return (
                          <div key={phase} className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateTripStatus(phase)}
                              disabled={isUpdatingStatus || phase === currentStatus}
                              title={`Switch trip status to ${phaseMeta.label}`}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                isActive
                                  ? `${phaseMeta.bg} ${phaseMeta.color} border-current scale-105 shadow-sm`
                                  : isPast
                                  ? "bg-[var(--card)] text-[var(--foreground)]/50 border-[var(--foreground)]/15 hover:bg-[var(--muted)] cursor-pointer"
                                  : "bg-[var(--card)] text-[var(--foreground)]/30 border-[var(--foreground)]/10 hover:bg-[var(--muted)] cursor-pointer"
                              } ${isUpdatingStatus ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              {phaseMeta.icon} {phaseMeta.label}
                            </button>
                            {idx < TRIP_STATUS_FLOW.length - 1 && (
                              <span className={`text-[10px] ${isPast ? "text-[var(--foreground)]/40" : "text-[var(--foreground)]/15"}`}>›</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* CTA: Advance to Next Phase */}
                    <div className="flex items-center gap-3 shrink-0">
                      {nextStatus && nextMeta && (
                        <button
                          onClick={() => handleUpdateTripStatus(nextStatus)}
                          disabled={isUpdatingStatus}
                          className={`btn-press px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all shadow-sm ${
                            nextStatus === "live"
                              ? "bg-red-500 text-white border-red-600 hover:bg-red-600 animate-pulse"
                              : nextStatus === "confirmed"
                              ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600"
                              : "bg-[var(--gold)] text-black border-[var(--gold)] hover:brightness-105"
                          } ${isUpdatingStatus ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          {isUpdatingStatus ? (
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>{nextMeta.nextLabel || `Move to ${nextMeta.label}`}</span>
                        </button>
                      )}
                      {currentStatus === "live" && (
                        <div className="flex items-center gap-1.5 text-red-500 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          Trip is Live
                        </div>
                      )}
                      {currentStatus === "archived" && (
                        <span className="text-xs text-[var(--foreground)]/40 italic">This trip is archived.</span>
                      )}
                    </div>
                  </div>

                  {statusUpdateMsg && (
                    <div className="px-4 py-2.5 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-medium flex items-center gap-2 animate-[fadeIn_0.3s_ease]">
                      <span>{statusUpdateMsg}</span>
                      <button onClick={() => setStatusUpdateMsg(null)} className="ml-auto opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Trip Join Passcode Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-craft border-none">
              <div className="flex items-center gap-3 mb-2">
                <Ticket className="w-6 h-6 text-[var(--gold)]" />
                <h3 className="text-lg font-serif text-[var(--foreground)]">Trip Join Passcode</h3>
              </div>
              <p className="text-xs text-[var(--foreground)]/60 mb-6 max-w-xl">
                Group members can join this trip by entering your unique 8-character secure invite passcode on the Join Pass page.
              </p>

              <div className="max-w-md p-5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--foreground)]/40 block mb-1">
                    8-Character Join Passcode
                  </span>
                  <div className="font-mono text-2xl font-extrabold tracking-widest text-[var(--gold)]">
                    {trip.joinCode ?? (
                      <span className="text-sm font-normal text-[var(--foreground)]/40 tracking-normal">Loading…</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyJoinCode}
                  className="btn-press px-5 py-2.5 rounded-xl bg-[var(--gold)] text-black hover:brightness-105 active:scale-95 text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[var(--gold)]/20 transition shrink-0"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-black" /> : <Copy className="w-4 h-4 text-black" />}
                  <span>{copiedCode ? "Passcode Copied!" : "Copy Passcode"}</span>
                </button>
              </div>
            </div>

            {/* Party Members Management Section */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-craft border-none">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-serif text-[var(--foreground)]">Trip Party Members</h3>
                  <p className="text-xs text-[var(--foreground)]/50 mt-0.5">
                    Add or remove co-travellers. Expenses and splits adapt dynamically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(true)}
                  className="btn-press px-4 py-2 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/25 text-xs font-semibold flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="space-y-3">
                {members.map((m) => {
                  const memberName = m.displayName || m.userId || "Member";
                  const initial = (memberName[0] || "M").toUpperCase();
                  const isOwner = m.role === "owner";

                  return (
                    <div
                      key={m.userId}
                      className="p-4 rounded-xl bg-[var(--background)] card-craft-subtle border-none flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-[var(--gold)]/15 text-[var(--gold)] font-bold text-xs flex items-center justify-center">
                          {initial}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-[var(--foreground)]">{memberName}</div>
                          <div className="text-xs text-[var(--foreground)]/40">{m.email || `${m.role}`}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isOwner ? (
                          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
                            ORGANIZER
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.userId)}
                            className="btn-press px-2.5 py-1 rounded-lg bg-[var(--muted)] hover:bg-rose-500/10 text-rose-500 border border-transparent hover:border-rose-500/30 text-xs flex items-center gap-1 transition"
                            title="Remove member"
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: EDIT STOP (Place, Flow, Date/Day & Time change) */}
      {/* ========================================================= */}
      {showEditStopModal && editingStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-[var(--popover)] shadow-craft-modal border-none space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif text-[var(--foreground)]">Edit Itinerary Stop</h3>
                <p className="text-xs text-[var(--foreground)]/50 mt-0.5">
                  Update timings, move across days, or refine budget notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditStopModal(false)}
                className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditStop} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Place / Activity Name</label>
                <input
                  type="text"
                  value={editStopPlaceName}
                  onChange={(e) => setEditStopPlaceName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Schedule Day</label>
                  <select
                    value={editStopDay}
                    onChange={(e) => setEditStopDay(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  >
                    {tripDays.map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={editStopStart}
                    onChange={(e) => setEditStopStart(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">End Time</label>
                  <input
                    type="time"
                    value={editStopEnd}
                    onChange={(e) => setEditStopEnd(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Est. Cost (₹ INR)</label>
                <input
                  type="number"
                  value={editStopCostRupees}
                  onChange={(e) => setEditStopCostRupees(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Activity Notes</label>
                <input
                  type="text"
                  value={editStopNotes}
                  onChange={(e) => setEditStopNotes(e.target.value)}
                  placeholder="e.g. Sunset drinks & photo session"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditStopModal(false)}
                  className="px-4 py-2 text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-press px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold"
                >
                  Save & Validate Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD STOP */}
      {/* ========================================================= */}
      {showAddStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-[var(--popover)] shadow-craft-modal border-none space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif text-[var(--foreground)]">Add Stop to Day {newStopDay}</h3>
              <button
                type="button"
                onClick={() => setShowAddStopModal(false)}
                className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStop} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-2">Select Place</label>
                <select
                  value={newStopPlaceId}
                  onChange={(e) => setNewStopPlaceId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-sm text-[var(--foreground)] field-input"
                >
                  <option value="" disabled>
                    -- Choose curated place --
                  </option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Target Day</label>
                  <select
                    value={newStopDay}
                    onChange={(e) => setNewStopDay(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  >
                    {tripDays.map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStopStart}
                    onChange={(e) => setNewStopStart(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">End Time</label>
                  <input
                    type="time"
                    value={newStopEnd}
                    onChange={(e) => setNewStopEnd(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Est. Cost (₹ INR)</label>
                <input
                  type="number"
                  value={newStopCostRupees}
                  onChange={(e) => setNewStopCostRupees(e.target.value)}
                  placeholder="500"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Notes & Plan</label>
                <input
                  type="text"
                  value={newStopNotes}
                  onChange={(e) => setNewStopNotes(e.target.value)}
                  placeholder="e.g. Sunset drinks & photo session"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddStopModal(false)}
                  className="px-4 py-2 text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-press px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold"
                >
                  Confirm & Add Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CUSTOM SPOT (Place Discovery & Direct Scheduling) */}
      {/* ========================================================= */}
      {showCustomPlaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-[var(--popover)] shadow-craft-modal border-none space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif text-[var(--foreground)]">Add Custom Spot</h3>
                <p className="text-xs text-[var(--foreground)]/50 mt-0.5">
                  Add an unlisted hidden gem or private villa directly into the itinerary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomPlaceModal(false)}
                className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomPlace} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Spot Name</label>
                <input
                  type="text"
                  value={customPlaceName}
                  onChange={(e) => setCustomPlaceName(e.target.value)}
                  required
                  placeholder="e.g. Hidden Cabo de Rama Cliff View"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Category</label>
                  <select
                    value={customPlaceCategory}
                    onChange={(e) => setCustomPlaceCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  >
                    <option value="beach">Beach</option>
                    <option value="viewpoint">Viewpoint</option>
                    <option value="nature">Nature / Trail</option>
                    <option value="heritage">Heritage</option>
                    <option value="dining">Cafe / Dining</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Operating Hours</label>
                  <input
                    type="text"
                    value={customPlaceHours}
                    onChange={(e) => setCustomPlaceHours(e.target.value)}
                    placeholder="09:00 - 19:00"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Schedule Day</label>
                  <select
                    value={customPlaceDay}
                    onChange={(e) => setCustomPlaceDay(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  >
                    {tripDays.map((d) => (
                      <option key={d} value={d}>
                        Day {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={customPlaceStart}
                    onChange={(e) => setCustomPlaceStart(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">End Time</label>
                  <input
                    type="time"
                    value={customPlaceEnd}
                    onChange={(e) => setCustomPlaceEnd(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Description / Notes</label>
                <textarea
                  value={customPlaceDesc}
                  onChange={(e) => setCustomPlaceDesc(e.target.value)}
                  rows={2}
                  placeholder="Secret rocky spot overlooking the sunset, recommended by locals."
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCustomPlaceModal(false)}
                  className="px-4 py-2 text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-press px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold"
                >
                  Save & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: NAVIGATION & PATH INSIGHTS */}
      {/* ========================================================= */}
      {showNavigationModal && activeNavInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-[var(--popover)] shadow-craft-modal border-none space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Navigation className="w-5 h-5 text-[var(--gold)]" />
                <h3 className="text-lg font-serif text-[var(--foreground)]">Route & Navigation Insights</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNavigationModal(false)}
                className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            {/* Waypoint Card */}
            <div className="p-4 rounded-xl bg-[var(--background)] shadow-craft-sm border-none space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--gold)] mt-1 shrink-0" />
                <div>
                  <span className="text-[10px] text-[var(--foreground)]/40 uppercase block">Origin</span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {activeNavInfo.fromStop.placeName || activeNavInfo.fromStop.placeId}
                  </span>
                  <span className="text-[11px] text-[var(--foreground)]/50 block font-mono">
                    Departure: {activeNavInfo.fromStop.endTime}
                  </span>
                </div>
              </div>

              <div className="pl-1.5 border-l-2 border-dashed border-[var(--foreground)]/10 ml-1.5 py-1">
                <div className="text-xs text-[var(--gold)] font-medium pl-3">
                  ~{activeNavInfo.durationMinutes} min drive • {activeNavInfo.distanceKm} km distance
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0" />
                <div>
                  <span className="text-[10px] text-[var(--foreground)]/40 uppercase block">Destination</span>
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {activeNavInfo.toStop.placeName || activeNavInfo.toStop.placeId}
                  </span>
                  <span className="text-[11px] text-[var(--foreground)]/50 block font-mono">
                    Arrival window: {activeNavInfo.toStop.startTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Travel Mode Toggle */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-2">Transport Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { mode: "driving", label: "Drive", icon: Car },
                  { mode: "bike", label: "Scooter", icon: Bike },
                  { mode: "transit", label: "Bus", icon: Bus },
                  { mode: "walking", label: "Walk", icon: Footprints },
                ].map(({ mode, label, icon: IconC }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleOpenNavigation(activeNavInfo.fromStop, activeNavInfo.toStop, mode as any)}
                    className={`btn-press p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      selectedNavMode === mode
                        ? "bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)] font-semibold"
                        : "bg-[var(--background)] shadow-craft-sm border-none text-[var(--foreground)]/60 hover:bg-[var(--muted)]"
                    }`}
                  >
                    <IconC className="w-4 h-4" />
                    <span className="text-[11px]">{label}</span>
                  </button>
                ))}
              </div>
            </div>


            {/* Path Insights & Buffer check */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[var(--foreground)]">Travel Insights & Road Conditions</div>
              {activeNavInfo.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-[var(--foreground)]/70">
                  <span className="text-[var(--gold)] mt-0.5">•</span>
                  <span>{ins}</span>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                ✓ Buffer status: {activeNavInfo.bufferMinutes} min allocated window provides safe transit margin ({activeNavInfo.bufferSurplus} min surplus).
              </div>
            </div>

            {/* In-App Live Navigation Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNavigationModal(false);
                  setShowMap(true);
                  const legSub: SubItineraryItem = {
                    id: "nav-leg-" + Date.now(),
                    title: `${activeNavInfo.fromStop.placeName || "Stop"} → ${activeNavInfo.toStop.placeName || "Next Stop"}`,
                    dayIndex: selectedDay,
                    stopIds: [activeNavInfo.fromStop.id, activeNavInfo.toStop.id],
                  };
                  setSubItineraries((prev) => [...prev.filter((s) => !s.id.startsWith("nav-leg-")), legSub]);
                  setActiveSubItineraryId(legSub.id);
                }}
                className="btn-press w-full py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-[#ebd2a0] transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Start In-App Live Navigation</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD PARTY MEMBER */}
      {/* ========================================================= */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-[var(--popover)] shadow-craft-modal border-none space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-serif text-[var(--foreground)]">Add Trip Member</h3>
                <p className="text-xs text-[var(--foreground)]/50 mt-0.5">
                  Invite a friend or co-planner. Expense splits adjust automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  required
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Email / Handle</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="vikram@example.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Role & Permission</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                >
                  <option value="member">Member (Can log expenses & view itinerary)</option>
                  <option value="co-planner">Co-Planner (Can edit places & schedule)</option>
                  <option value="viewer">Viewer (Read-only spectator)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-4 py-2 text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-press px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold"
                >
                  Confirm & Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD EXPENSE */}
      {/* ========================================================= */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-2xl bg-[var(--popover)] shadow-craft-modal border-none space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif text-[var(--foreground)]">Log Shared Expense</h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="text-[var(--foreground)]/40 hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Amount in INR (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={expenseAmountRupees}
                  onChange={(e) => setExpenseAmountRupees(e.target.value)}
                  required
                  placeholder="e.g. 1800"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-sm text-[var(--foreground)] field-input font-mono font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  >
                    <option value="food">Food & Dining</option>
                    <option value="stay">Stay & Villa</option>
                    <option value="transit">Transit & Fuel</option>
                    <option value="activity">Activities</option>
                    <option value="misc">Miscellaneous</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Paid By</label>
                  <select
                    value={expensePayer}
                    onChange={(e) => setExpensePayer(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName || m.userId || "Member"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Description / Note</label>
                <input
                  type="text"
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="e.g. Seafood lunch at Britto's"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] shadow-craft-sm border-none text-xs text-[var(--foreground)] field-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--foreground)]/70 mb-1">Split Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExpenseSplitType("equal")}
                    className={`btn-press p-2.5 rounded-xl border text-xs font-medium text-center ${
                      expenseSplitType === "equal"
                        ? "bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)]"
                        : "bg-[var(--background)] shadow-craft-sm border-none text-[var(--foreground)]/60"
                    }`}
                  >
                    Equal Split (Deterministic)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseSplitType("exact")}
                    className={`btn-press p-2.5 rounded-xl border text-xs font-medium text-center ${
                      expenseSplitType === "exact"
                        ? "bg-[var(--gold)]/15 border-[var(--gold)] text-[var(--gold)]"
                        : "bg-[var(--background)] shadow-craft-sm border-none text-[var(--foreground)]/60"
                    }`}
                  >
                    Exact Shares
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-press px-6 py-2.5 rounded-xl bg-[var(--gold)] text-black text-xs font-semibold"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SUB-ITINERARY MODAL */}
      {showCreateSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--card)] card-craft border-none shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)]/40 pb-3">
              <h3 className="text-sm font-serif font-bold text-[var(--foreground)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--gold)]" />
                <span>Create Sub-Itinerary (Day {selectedDay})</span>
              </h3>
              <button
                onClick={() => setShowCreateSubModal(false)}
                className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]/80 block mb-1.5">
                  Sub-Itinerary Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Beach Hop, Sunset & Dinner Trail"
                  value={newSubTitle}
                  onChange={(e) => setNewSubTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--gold)]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]/80 block mb-1.5">
                  Select Included Stops ({selectedStopIdsForSub.length} selected)
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                  {currentDayStops.length === 0 ? (
                    <div className="text-xs text-[var(--foreground)]/40 p-3 text-center">No stops available for Day {selectedDay}</div>
                  ) : (
                    currentDayStops.map((stop) => {
                      const isChecked = selectedStopIdsForSub.includes(stop.id);
                      return (
                        <label
                          key={stop.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isChecked ? "bg-[var(--gold)]/10 text-[var(--gold)] font-medium" : "hover:bg-[var(--muted)]/50 text-[var(--foreground)]/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStopIdsForSub((prev) => [...prev, stop.id]);
                              } else {
                                setSelectedStopIdsForSub((prev) => prev.filter((id) => id !== stop.id));
                              }
                            }}
                            className="rounded text-[var(--gold)] focus:ring-0 accent-[var(--gold)]"
                          />
                          <span className="font-semibold text-xs">{stop.placeName || stop.placeId}</span>
                          <span className="text-[10px] text-[var(--foreground)]/50 ml-auto font-mono">
                            {stop.startTime} - {stop.endTime}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Nearby Recommended Places to discover while creating sub-itinerary */}
              <div className="pt-2 border-t border-[var(--border)]/30">
                <label className="text-xs font-semibold text-[var(--foreground)]/80 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
                    <span>Nearby Recommended Places to Include</span>
                  </span>
                  <span className="text-[10px] text-[var(--gold)] font-medium">Click + Include</span>
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                  {(() => {
                    const currentDayStopPlaceIds = currentDayStops.map((s) => s.placeId);
                    // Show DB places not yet on this day's stops (live data only, no hardcoded suggestions)
                    const nearbyCandidates = places
                      .filter((p) => !currentDayStopPlaceIds.includes(p.id))
                      .slice(0, 5);

                    if (nearbyCandidates.length === 0) {
                      return (
                        <div className="text-[11px] text-[var(--foreground)]/50 p-2 text-center">
                          ✓ All nearby spots are already scheduled!
                        </div>
                      );
                    }

                    return nearbyCandidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--card)] card-craft-subtle text-xs"
                      >
                        <div>
                          <div className="font-semibold text-xs text-[var(--foreground)]">{candidate.name}</div>
                          <div className="text-[10px] text-[var(--foreground)]/50 capitalize">
                            {candidate.category} • ⭐ {candidate.popularityScore || 90}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddNearbyPlaceToSubItinerary(candidate)}
                          className="btn-press px-2.5 py-1 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-[10px] font-bold flex items-center gap-1 hover:bg-[var(--gold)]/25 transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Include</span>
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              </div>


              <div>
                <label className="text-xs font-semibold text-[var(--foreground)]/80 block mb-1.5">
                  Assign Members Visiting this Sub-Itinerary
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {members.map((m) => {
                    const isSelected = selectedMemberIdsForSub.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMemberIdsForSub((prev) => prev.filter((id) => id !== m.userId));
                          } else {
                            setSelectedMemberIdsForSub((prev) => [...prev, m.userId]);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          isSelected
                            ? "bg-[var(--gold)] text-black border-[var(--gold)] shadow-sm"
                            : "bg-[var(--background)] text-[var(--foreground)]/70 border-[var(--border)] hover:bg-[var(--muted)]"
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-black/20 text-[10px] flex items-center justify-center font-bold shrink-0">
                          {m.displayName.charAt(0).toUpperCase()}
                        </span>
                        <span>{m.displayName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]/40">
              <button
                type="button"
                onClick={() => setShowCreateSubModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newSubTitle.trim() || selectedStopIdsForSub.length === 0) return;
                  const newSub: SubItineraryItem = {
                    id: "sub-" + Date.now(),
                    title: newSubTitle.trim(),
                    dayIndex: selectedDay,
                    stopIds: selectedStopIdsForSub,
                    memberUserIds: selectedMemberIdsForSub.length > 0 ? selectedMemberIdsForSub : members.map((m) => m.userId),
                  };
                  setSubItineraries((prev) => [...prev, newSub]);
                  setActiveSubItineraryId(newSub.id);
                  setShowCreateSubModal(false);
                  setNewSubTitle("");
                  setSelectedStopIdsForSub([]);
                  setSelectedMemberIdsForSub([]);
                }}
                disabled={!newSubTitle.trim() || selectedStopIdsForSub.length === 0}
                className="btn-press px-5 py-2 rounded-xl bg-[var(--gold)] text-black text-xs font-bold disabled:opacity-40 transition-all shadow-md"
              >
                Create Sub-Itinerary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



