"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import VoyaraLogo from "@/components/voyara-logo";
import ThemeToggle from "@/components/theme-toggle";
import {
  Compass,
  Users,
  HeartHandshake,
  User,
  Car,
  Bike,
  Bus,
  Footprints,
  Calendar,
  Clock,
  Wallet,
  Sparkles,
  ArrowRight,
  MapPin,
  Check,
} from "lucide-react";

const CURATED_DESTINATIONS = [
  {
    id: "Goa",
    name: "Goa",
    tagline: "Sun-drenched beaches & Latin quarter heritage",
    badge: "Coastal & Heritage",
    image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "Coorg",
    name: "Coorg",
    tagline: "Misty highlands, waterfalls & coffee estates",
    badge: "Highland Mist",
    image: "https://images.unsplash.com/photo-1596401057633-54a8fe8ef647?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "Hampi",
    name: "Hampi",
    tagline: "Ancient Vijayanagara temples & boulder terrain",
    badge: "UNESCO Heritage",
    image: "https://images.unsplash.com/photo-1600100397608-f010f4438317?auto=format&fit=crop&w=400&q=80",
  },
];

const TRIP_TYPES = [
  {
    id: "group",
    label: "Friends Group",
    icon: Users,
    desc: "Shared splits, joint voting, multi-member join link",
  },
  {
    id: "family",
    label: "Family Vacation",
    icon: HeartHandshake,
    desc: "Paced days, kids & elders friendly, shared budget",
  },
  {
    id: "solo",
    label: "Solo Odyssey",
    icon: User,
    desc: "Flexible spontaneous discovery, single ledger",
  },
];

const TRANSPORT_MODES = [
  { id: "driving", label: "Car / SUV", icon: Car },
  { id: "scooter", label: "Scooter / Bike", icon: Bike },
  { id: "transit", label: "Cab / Transit", icon: Bus },
  { id: "walking", label: "Walking & Ferry", icon: Footprints },
];

export default function CreateTripClient() {
  const router = useRouter();

  const [destination, setDestination] = useState("Goa");
  const [customDestination, setCustomDestination] = useState("");
  const [tripType, setTripType] = useState("group");
  const [peopleCount, setPeopleCount] = useState(4);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("21:00");
  const [transportMode, setTransportMode] = useState("driving");
  const [budgetRupees, setBudgetRupees] = useState("");

  // Live curated stop counts from DB
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchPlaceCounts() {
      try {
        const dests = ["Goa", "Coorg", "Hampi"];
        const counts: Record<string, number> = {};
        await Promise.all(
          dests.map(async (dest) => {
            const res = await fetch(`/api/places?destination=${encodeURIComponent(dest)}`);
            if (res.ok) {
              const data = await res.json();
              counts[dest] = Array.isArray(data.places) ? data.places.length : 0;
            } else {
              counts[dest] = 0;
            }
          })
        );
        setPlaceCounts(counts);
      } catch {
        // silently ignore — counts just stay 0
      }
    }
    fetchPlaceCounts();
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeDestination = customDestination.trim() || destination;

  // Calculate days count
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
  const effectiveCount = tripType === "solo" ? 1 : peopleCount;
  const perPersonEst = Math.round((parseFloat(budgetRupees) || 0) / effectiveCount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!startDate || !endDate) {
      setErrorMsg("Please select your trip start and end dates.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg("Start date cannot be after end date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const budgetPaise = (parseFloat(budgetRupees) || 0) * 100;

      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: activeDestination,
          type: tripType,
          peopleCount: effectiveCount,
          startDate,
          endDate,
          dailyStart,
          dailyEnd,
          transportMode,
          budgetPaise,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.trip?.id) {
        throw new Error(data.error || "Failed to create trip");
      }

      router.push(`/trips/${data.trip.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--gold)]/30">
      {/* Top Nav */}
      <nav className="sticky top-0 z-40 transition-colors duration-300" style={{ background: "var(--nav-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <VoyaraLogo href="/dashboard" />
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <Link href="/dashboard" className="hover:text-[var(--foreground)] transition">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Form Container */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="page-enter stagger-1 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/25 text-[var(--gold)] text-xs font-medium tracking-wide mb-3">
            <Sparkles className="w-3 h-3 text-[var(--gold)]" />
            Trip Architect
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--foreground)] tracking-tight leading-tight">
            Create a New Journey
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-muted)]">
            Configure your destination, rhythm, and budget. Voyara initializes your journey with verified local gems, realistic transit buffers, and a secure group pass.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* 1. Destination Selection */}
          <div className="page-enter stagger-2 p-6 sm:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-lg font-serif font-medium text-[var(--foreground)] flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--gold)]" />
                  Select Destination
                </h2>
              </div>
              <span className="text-xs text-[var(--gold)] font-medium">Curated Local Catalog</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {CURATED_DESTINATIONS.map((d) => {
                const isSelected = destination === d.id && !customDestination;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDestination(d.id);
                      setCustomDestination("");
                    }}
                    className={`btn-press group text-left rounded-xl border transition-all overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 shadow-[0_0_15px_rgba(223,178,108,0.15)]"
                        : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Visual Photo Card */}
                    <div className="relative h-28 w-full overflow-hidden bg-neutral-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.image}
                        alt={d.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute top-2.5 right-2.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--background)]/60 text-white/90 border border-white/10 backdrop-blur-md">
                          {d.badge}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-3">
                        <span className="text-base font-serif font-bold text-[var(--foreground)] leading-tight drop-shadow-md">
                          {d.name}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 flex flex-col justify-between flex-1">
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-2.5">{d.tagline}</p>
                      <div className="flex items-center justify-between text-[11px] text-[var(--gold)]">
                        <span>
                          {placeCounts[d.id] !== undefined
                            ? `${placeCounts[d.id]} verified stop${placeCounts[d.id] === 1 ? "" : "s"}`
                            : "Loading stops…"}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Destination Input */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                Or enter another custom destination
              </label>
              <input
                type="text"
                value={customDestination}
                onChange={(e) => setCustomDestination(e.target.value)}
                placeholder="e.g. Manali, Pondicherry, Munnar..."
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-[var(--foreground)] placeholder-white/30 field-input"
              />
            </div>
          </div>

          {/* 2. Trip Type & Group Count */}
          <div className="page-enter stagger-3 p-6 sm:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-lg font-serif font-medium text-[var(--foreground)] flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--gold)]" />
                Travel Party Type
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
              {TRIP_TYPES.map((t) => {
                const isSelected = tripType === t.id;
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTripType(t.id);
                      if (t.id === "solo") setPeopleCount(1);
                    }}
                    className={`btn-press text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 shadow-[0_0_15px_rgba(223,178,108,0.12)]"
                        : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                        isSelected ? "bg-[var(--gold)] text-black" : "bg-white/[0.05] text-[var(--gold)]"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className={`text-sm font-semibold block mb-1 ${isSelected ? "text-[var(--gold)]" : "text-[var(--foreground)]"}`}>
                      {t.label}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t.desc}</p>
                  </button>
                );
              })}
            </div>

            {tripType !== "solo" && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <div className="text-sm font-medium text-[var(--foreground)]">Party Size</div>
                  <div className="text-xs text-[var(--text-muted)]">Used for equal expense splitting and transfer sizing</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPeopleCount(Math.max(2, peopleCount - 1))}
                    className="btn-press w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[var(--foreground)] flex items-center justify-center font-bold hover:bg-white/[0.1]"
                  >
                    -
                  </button>
                  <span className="text-base font-semibold font-mono text-[var(--gold)] w-6 text-center">
                    {peopleCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPeopleCount(peopleCount + 1)}
                    className="btn-press w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[var(--foreground)] flex items-center justify-center font-bold hover:bg-white/[0.1]"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Dates & Daily Rhythm */}
          <div className="page-enter stagger-4 p-6 sm:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-lg font-serif font-medium text-[var(--foreground)] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--gold)]" />
                  Calendar & Daily Windows
                </h2>
              </div>
              <span className="text-xs text-[var(--gold)] font-mono px-2.5 py-1 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/20">
                {diffDays} {diffDays === 1 ? "Day" : "Days"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-[var(--foreground)] field-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-[var(--foreground)] field-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-white/[0.06]">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  Daily Start Hour <span className="text-[var(--text-subtle)]">(Activities begin)</span>
                </label>
                <input
                  type="time"
                  value={dailyStart}
                  onChange={(e) => setDailyStart(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-[var(--foreground)] field-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  Daily End Hour <span className="text-[var(--text-subtle)]">(Dinner / Rest wrap)</span>
                </label>
                <input
                  type="time"
                  value={dailyEnd}
                  onChange={(e) => setDailyEnd(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-[var(--foreground)] field-input"
                />
              </div>
            </div>
          </div>

          {/* 4. Transport & Trip Budget */}
          <div className="page-enter stagger-5 p-6 sm:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-lg font-serif font-medium text-[var(--foreground)] flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[var(--gold)]" />
                Transport & Trip Budget
              </h2>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-white/70 mb-2">Primary Transport Mode</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TRANSPORT_MODES.map((tm) => {
                  const isSelected = transportMode === tm.id;
                  const IconComponent = tm.icon;
                  return (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => setTransportMode(tm.id)}
                      className={`btn-press p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 text-[var(--gold)]"
                          : "bg-white/[0.02] border-white/[0.08] text-[var(--foreground)] hover:border-white/[0.15]"
                      }`}
                    >
                      <IconComponent className="w-5 h-5 mb-0.5" />
                      <span className="text-xs font-medium block">{tm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-white/70">
                  Total Trip Budget (in INR ₹)
                </label>
                <span className="text-xs text-[var(--gold)] font-mono">
                  Est. ₹{perPersonEst.toLocaleString("en-IN")} / person
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)] font-serif text-lg">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={budgetRupees}
                  onChange={(e) => setBudgetRupees(e.target.value)}
                  placeholder="e.g. 45000"
                  required
                  className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.12] text-sm text-[var(--foreground)] placeholder-white/30 field-input font-medium font-mono"
                />
              </div>
              <p className="text-xs text-[var(--text-subtle)] mt-1.5">
                Automated budget monitoring warns if scheduled places and transport exceed this ceiling.
              </p>
            </div>
          </div>

          {/* Submit Row */}
          <div className="page-enter stagger-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition order-2 sm:order-1"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-press w-full sm:w-auto px-9 py-3.5 rounded-full bg-[var(--gold)] text-black font-semibold text-sm tracking-wide shadow-lg shadow-[var(--gold)]/20 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Architecting Journey & Initializing Passes...
                </>
              ) : (
                <>
                  <span>Create Trip & Open Workspace</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
