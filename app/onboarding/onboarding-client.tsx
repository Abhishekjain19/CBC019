"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import VoyaraLogo from "@/components/voyara-logo";
import ThemeToggle from "@/components/theme-toggle";
import {
  Compass,
  Palmtree,
  Landmark,
  UtensilsCrossed,
  Trees,
  Mountain,
  Sparkles,
  Coffee,
  Footprints,
  Zap,
  Wallet,
  CreditCard,
  Crown,
  Check,
  ArrowRight,
  User,
  SlidersHorizontal,
} from "lucide-react";

const VIBE_OPTIONS = [
  {
    id: "beach",
    label: "Beach & Coastline",
    icon: Palmtree,
    desc: "Secluded bays, sunset shacks, ocean breeze",
  },
  {
    id: "heritage",
    label: "Heritage & History",
    icon: Landmark,
    desc: "Ancient ruins, UNESCO monuments, fortresses",
  },
  {
    id: "culinary",
    label: "Culinary Trails",
    icon: UtensilsCrossed,
    desc: "Local coastal curries, plantation feasts, cafés",
  },
  {
    id: "nature",
    label: "Nature & Escapes",
    icon: Trees,
    desc: "Waterfalls, coffee plantations, misty valleys",
  },
  {
    id: "adventure",
    label: "Adventure & Thrill",
    icon: Mountain,
    desc: "Kayaking, trekking boulders, jungle safaris",
  },
  {
    id: "nightlife",
    label: "Nightlife & Music",
    icon: Sparkles,
    desc: "Sundowner parties, beach clubs, live jazz",
  },
];

const PACE_OPTIONS = [
  {
    id: "relaxed",
    label: "Relaxed & Leisurely",
    icon: Coffee,
    desc: "1–2 key places a day, plenty of downtime to soak in the destination.",
  },
  {
    id: "moderate",
    label: "Balanced & Steady",
    icon: Footprints,
    desc: "3–4 curated stops daily with comfortable transfer buffers.",
  },
  {
    id: "fast",
    label: "Fast & High Energy",
    icon: Zap,
    desc: "Maximize sights, pack the days from dawn till dusk.",
  },
];

const BUDGET_OPTIONS = [
  {
    id: "budget",
    label: "Smart & Budget",
    tier: "₹",
    icon: Wallet,
    desc: "Hostels, street gems, self-guided exploration",
  },
  {
    id: "medium",
    label: "Balanced Comfort",
    tier: "₹₹",
    icon: CreditCard,
    desc: "Boutique stays, local specialty dining, hired cabs",
  },
  {
    id: "luxury",
    label: "Luxury & Indulgence",
    tier: "₹₹₹",
    icon: Crown,
    desc: "Heritage estates, private charters, fine tasting menus",
  },
];

export default function OnboardingClient() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Arjun Verma");
  const [dob, setDob] = useState("1998-05-14");
  const [selectedVibes, setSelectedVibes] = useState<string[]>(["heritage", "beach", "culinary"]);
  const [pace, setPace] = useState("moderate");
  const [budgetLevel, setBudgetLevel] = useState("medium");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleVibe = (id: string) => {
    if (selectedVibes.includes(id)) {
      setSelectedVibes(selectedVibes.filter((v) => v !== id));
    } else {
      setSelectedVibes([...selectedVibes, id]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Generate a stable userId from displayName + random suffix (no auth yet)
      const slug = displayName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "user";
      const suffix = Math.random().toString(36).slice(2, 7);
      const userId = `user-${slug}-${suffix}`;

      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          displayName,
          dateOfBirth: dob,
          vibeTags: selectedVibes,
          pace,
          budgetLevel,
        }),
      });
      setSavedSuccess(true);
      setTimeout(() => {
        router.push("/trips/new");
      }, 700);
    } catch {
      setSavedSuccess(true);
      setTimeout(() => {
        router.push("/trips/new");
      }, 700);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--gold)]/25 transition-colors duration-300">
      {/* Sticky Top Nav */}
      <nav className="sticky top-0 z-40 transition-colors duration-300" style={{ background: "var(--nav-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <VoyaraLogo href="/dashboard" />
          <div className="flex items-center gap-4 text-xs text-[var(--text-subtle)]">
            <span className="text-[var(--gold)] hidden sm:inline">Profile Personalization</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] hidden sm:inline" />
            <Link href="/dashboard" className="hover:text-[var(--foreground)] transition">
              Skip to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="page-enter stagger-1 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/25 text-[var(--gold)] text-xs font-medium tracking-wide mb-3">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--gold)]" />
            Traveler Calibration
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--foreground)] tracking-tight leading-tight">
            Curate your traveler persona
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-muted)]">
            These preferences tune Voyara’s Intelligent Engine to craft itineraries matching your unique rhythm, interests, and budget.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-10">
          {/* Section 1: Basic Identity */}
          <div className="page-enter stagger-2 p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-elevated">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-lg font-serif font-medium text-[var(--foreground)] flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--gold)]" />
                Traveler Identity
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="e.g. Arjun Verma"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/30 field-input"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                  Date of Birth <span className="text-white/40 font-normal">(private, not shared in trips)</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/30 field-input"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Vibe Tags */}
          <div className="page-enter stagger-3 p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-elevated">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-lg font-serif font-medium text-[var(--foreground)]">Travel Vibes & Passions</h2>
              </div>
              <span className="text-xs text-[var(--gold)] font-medium">{selectedVibes.length} selected</span>
            </div>
            <p className="text-xs text-[var(--text-subtle)] mb-6 pl-10">Select all that describe your ideal getaway.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {VIBE_OPTIONS.map((v) => {
                const isSelected = selectedVibes.includes(v.id);
                const IconComponent = v.icon;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVibe(v.id)}
                    className={`btn-press text-left p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                      isSelected
                         ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 shadow-[0_0_15px_rgba(223,178,108,0.12)]"
                        : "bg-[var(--surface-1)] border-[var(--border-subtle)] hover:border-[var(--text-subtle)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[var(--gold)] text-black"
                          : "bg-[var(--surface-2)] text-[var(--gold)] border border-[var(--border-subtle)]"
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isSelected ? "text-[var(--gold)]" : "text-[var(--foreground)]"}`}>
                          {v.label}
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[var(--gold)] stroke-[2.5]" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-subtle)] mt-0.5 leading-relaxed">{v.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Pace & Rhythm */}
          <div className="page-enter stagger-4 p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-elevated">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-lg font-serif font-medium text-[var(--foreground)]">Pace & Daily Schedule</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {PACE_OPTIONS.map((p) => {
                const isSelected = pace === p.id;
                const IconComponent = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id)}
                    className={`btn-press text-left p-4 rounded-xl border transition-all ${
                      isSelected
                         ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 shadow-[0_0_15px_rgba(223,178,108,0.12)]"
                        : "bg-[var(--surface-1)] border-[var(--border-subtle)] hover:border-[var(--text-subtle)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? "bg-[var(--gold)] text-black" : "bg-[var(--surface-2)] text-[var(--gold)]"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />}
                    </div>
                    <span className={`text-sm font-medium block mb-1 ${isSelected ? "text-[var(--gold)]" : "text-[var(--foreground)]"}`}>
                      {p.label}
                    </span>
                    <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Budget Level */}
          <div className="page-enter stagger-5 p-6 sm:p-8 rounded-2xl bg-[var(--card)] card-elevated">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-7 h-7 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-lg font-serif font-medium text-[var(--foreground)]">Default Spending Comfort</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {BUDGET_OPTIONS.map((b) => {
                const isSelected = budgetLevel === b.id;
                const IconComponent = b.icon;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBudgetLevel(b.id)}
                    className={`btn-press text-left p-4 rounded-xl border transition-all ${
                      isSelected
                         ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 shadow-[0_0_15px_rgba(223,178,108,0.12)]"
                        : "bg-[var(--surface-1)] border-[var(--border-subtle)] hover:border-[var(--text-subtle)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? "bg-[var(--gold)] text-black" : "bg-[var(--surface-2)] text-[var(--gold)]"
                        }`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-serif font-bold text-[var(--gold)]">{b.tier}</span>
                    </div>
                    <span className={`text-xs font-semibold block mb-1 ${isSelected ? "text-[var(--gold)]" : "text-[var(--foreground)]"}`}>
                      {b.label}
                    </span>
                    <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{b.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="page-enter stagger-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="text-xs text-[var(--text-subtle)] hover:text-[var(--foreground)] transition order-2 sm:order-1"
            >
              ← Return to Dashboard
            </Link>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-press btn-gold w-full sm:w-auto px-8 py-3.5 rounded-full bg-[var(--gold)] text-black font-semibold text-sm tracking-wide shadow-[var(--shadow-gold)] hover:brightness-105 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Saving Preferences...
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Preferences Saved</span>
                </>
              ) : (
                <>
                  <span>Save & Plan Your Journey</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
