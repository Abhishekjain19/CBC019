"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VoyaraLogo from "@/components/voyara-logo";
import {
  MapPin,
  Calendar,
  Users,
  Wallet,
  ArrowRight,
  Plus,
  SlidersHorizontal,
  Compass,
  Ticket,
  TrendingUp,
} from "lucide-react";

interface TripItem {
  id: string;
  name: string;
  destination: string;
  dates: string;
  type: string;
  members: number;
  status: "planning" | "confirmed";
  image: string;
  budget: string;
  days: number;
  stopsCount: number;
}

const STATUS_MAP = {
  confirmed: {
    label: "Confirmed",
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 text-emerald-500 dark:text-emerald-400",
  },
  planning: {
    label: "In Planning",
    dot: "bg-[var(--gold)] status-dot-pulse",
    badge: "bg-[var(--gold)]/10 text-[var(--gold)]",
  },
};

const METRIC_ICONS: Record<string, any> = {
  TrendingUp,
  Users,
  Compass,
  Wallet,
};

export default function DashboardClient() {
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrips() {
      try {
        const res = await fetch("/api/trips");
        if (res.ok) {
          const data = await res.json();
          if (data.trips) setTrips(data.trips);
          if (data.metrics) setMetrics(data.metrics);
        }
      } catch (err) {
        console.error("Failed to load trips from database:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--gold)]/25 transition-colors duration-300">
      {/* ── Navigation ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 sm:px-10 h-16 transition-all duration-300"
        style={{
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <VoyaraLogo />
        <div className="flex items-center gap-2">
          <Link
            href="/onboarding"
            className="btn-press hidden sm:inline-flex text-xs text-[var(--gold)] transition-colors px-3 py-1.5 rounded-full bg-[var(--gold)]/10 hover:bg-[var(--gold)]/15 items-center gap-1.5 font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Preferences
          </Link>
          <Link
            href="/join"
            className="btn-press text-xs text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition-colors px-3 py-1.5 rounded-full bg-[var(--surface-1)] hover:bg-[var(--surface-2)] flex items-center gap-1.5 font-medium"
          >
            <Ticket className="w-3.5 h-3.5 text-[var(--gold)]" />
            <span className="hidden sm:inline">Join Pass</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-xs text-[var(--text-subtle)] hover:text-[var(--foreground)] transition-colors px-3 py-1.5 hidden sm:inline"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="btn-press btn-gold bg-[var(--gold)] text-black px-4 py-1.5 rounded-full text-xs font-bold shadow-[var(--shadow-gold)]"
          >
            Sign Up
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-12 pb-24">
        {/* ── Hero header ── */}
        <div className="flex items-end justify-between gap-6 mb-10 flex-wrap page-enter stagger-1">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-extrabold text-[var(--foreground)] tracking-tight leading-tight">
              My Journeys
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-md leading-relaxed">
              Curated itineraries, synchronised group members, and live split ledgers — all in one place.
            </p>
          </div>
          <Link
            href="/trips/new"
            id="create-trip-btn"
            className="btn-press btn-gold inline-flex items-center gap-2 bg-[var(--gold)] hover:brightness-105 text-black px-6 py-3 rounded-full text-sm font-bold shadow-[var(--shadow-gold)] transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Plan New Trip
          </Link>
        </div>

        {/* ── Metrics strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10 page-enter stagger-2">
          {loading ? (
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-2xl bg-[var(--card)] card-elevated animate-pulse space-y-2">
                <div className="h-3 w-16 bg-[var(--foreground)]/10 rounded" />
                <div className="h-6 w-24 bg-[var(--foreground)]/10 rounded" />
                <div className="h-2.5 w-12 bg-[var(--foreground)]/10 rounded" />
              </div>
            ))
          ) : (
            metrics.map(({ label, value, sub, icon, accent }) => {
              const IconComp = METRIC_ICONS[icon] || TrendingUp;
              return (
                <div
                  key={label}
                  className="p-4 rounded-2xl bg-[var(--card)] card-elevated group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-subtle)] font-semibold">{label}</span>
                    <IconComp className="w-3.5 h-3.5 text-[var(--text-subtle)] group-hover:text-[var(--gold)] transition-colors" />
                  </div>
                  <div className={`text-xl font-bold font-mono ${accent ? "text-emerald-500" : "text-[var(--foreground)]"}`}>
                    {value}
                  </div>
                  <div className="text-[11px] text-[var(--text-subtle)] mt-0.5 capitalize">{sub}</div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Trip cards ── */}
        {loading ? (
          <div className="grid gap-4 mb-12">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 rounded-2xl bg-[var(--card)] card-elevated animate-pulse flex flex-col sm:flex-row items-center gap-6">
                <div className="w-[88px] h-[88px] rounded-xl bg-[var(--foreground)]/10 shrink-0" />
                <div className="flex-1 space-y-3 w-full">
                  <div className="h-5 w-48 bg-[var(--foreground)]/10 rounded" />
                  <div className="h-3 w-72 bg-[var(--foreground)]/10 rounded" />
                  <div className="h-3 w-32 bg-[var(--foreground)]/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : trips.length > 0 ? (
          <div className="grid gap-4 mb-12">
            {trips.map((trip, idx) => {
              const s = STATUS_MAP[trip.status] ?? STATUS_MAP.planning;
              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  id={`trip-card-${trip.id}`}
                  className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 rounded-2xl p-5 sm:p-6 bg-[var(--card)] card-elevated overflow-hidden page-enter"
                  style={{ animationDelay: `${(idx + 2) * 55}ms` }}
                >
                  {/* Gold hover accent line */}
                  <div className="absolute inset-y-0 left-0 w-0.5 bg-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity rounded-l-2xl" />

                  {/* Destination image */}
                  <div className="relative w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0 bg-[var(--surface-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={trip.image}
                      alt={`${trip.destination} destination photo`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 flex-wrap mb-1.5">
                      <h2 className="text-base sm:text-lg font-bold font-serif text-[var(--foreground)] leading-snug group-hover:text-[var(--gold)] transition-colors truncate">
                        {trip.name}
                      </h2>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] mb-2.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--gold)]" />
                        {trip.destination}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                        {trip.dates}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[var(--text-subtle)]" />
                        {trip.type} · {trip.members} travellers
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--gold)]/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                      {trip.stopsCount} curated stops mapped
                    </div>
                  </div>

                  {/* Right: budget + CTA */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-4 pt-3 sm:pt-0 border-t border-[var(--border-subtle)] sm:border-none shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--text-subtle)] flex items-center sm:justify-end gap-1 mb-0.5">
                        <Wallet className="w-3 h-3" /> Budget
                      </div>
                      <div className="text-sm font-bold font-mono text-[var(--foreground)]">{trip.budget}</div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--gold)] group-hover:gap-2.5 transition-all">
                      Open Workspace
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center text-center py-20 rounded-2xl mb-12 bg-[var(--card)] card-elevated page-enter stagger-2">
            <div className="w-16 h-16 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)] mb-6">
              <Compass className="w-8 h-8 text-[var(--gold)]" />
            </div>
            <h2 className="text-xl font-serif font-bold text-[var(--foreground)] mb-2">No Journeys Planned Yet</h2>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mb-8 leading-relaxed">
              Start planning your next escape with intelligent day scheduling, conflict detection, and real-time expense sharing.
            </p>
            <Link
              href="/trips/new"
              className="btn-press btn-gold inline-flex items-center gap-2 bg-[var(--gold)] hover:brightness-105 text-black px-6 py-3 rounded-full text-sm font-bold shadow-[var(--shadow-gold)] transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Create Your First Trip
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
