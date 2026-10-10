"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Users, Receipt, ArrowRight } from "lucide-react";
import { VoyaraLogo } from "@/components/voyara-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignUpPage() {
  const [focused, setFocused] = useState<string | null>(null);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex overflow-hidden selection:bg-[var(--gold)]/30 transition-colors duration-200">
      {/* ── Left panel — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-0 relative">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <VoyaraLogo size="md" href="/" />
        </div>

        <div className="w-full max-w-[380px]">
          {/* Header */}
          <div className="mb-8 page-enter stagger-1">
            <h1 className="text-[28px] font-serif font-extrabold text-[var(--foreground)] tracking-tight mb-2">Create account</h1>
            <p className="text-sm text-[var(--foreground)]/55">Start planning extraordinary trips, free forever.</p>
          </div>

          {/* Form */}
          <form className="space-y-5 page-enter stagger-2" onSubmit={(e) => { e.preventDefault(); window.location.href = "/onboarding"; }}>
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="sign-up-name" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground)]/50">
                Full Name
              </label>
              <input
                id="sign-up-name"
                type="text"
                autoComplete="name"
                placeholder="Arjun Verma"
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                className="field-input w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/30 bg-[var(--card)] shadow-[var(--shadow-card)] focus:border-[var(--gold)]"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="sign-up-email" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground)]/50">
                Email
              </label>
              <input
                id="sign-up-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                className="field-input w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/30 bg-[var(--card)] shadow-[var(--shadow-card)] focus:border-[var(--gold)]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="sign-up-password" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground)]/50">
                Password
              </label>
              <input
                id="sign-up-password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                className="field-input w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] placeholder-[var(--foreground)]/30 bg-[var(--card)] shadow-[var(--shadow-card)] focus:border-[var(--gold)]"
              />
            </div>

            {/* Submit */}
            <button
              id="sign-up-submit"
              type="submit"
              className="btn-press w-full bg-[var(--gold)] text-black py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-[var(--gold)]/20 hover:brightness-105 mt-2 flex items-center justify-center gap-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7 page-enter stagger-3">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-xs text-[var(--foreground)]/30">or</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          {/* Switch */}
          <p className="text-sm text-[var(--foreground)]/55 text-center page-enter stagger-4">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[var(--gold)] font-semibold hover:underline">
              Sign in
            </Link>
          </p>

          {/* Legal */}
          <p className="text-center text-[11px] text-[var(--foreground)]/30 mt-8 leading-relaxed page-enter stagger-5">
            By creating an account, you agree to our{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-[var(--foreground)]/60 transition-colors">Terms of Service</span>
            {" "}and{" "}
            <span className="underline underline-offset-2 cursor-pointer hover:text-[var(--foreground)]/60 transition-colors">Privacy Policy</span>.
          </p>
        </div>
      </div>

      {/* ── Right panel — brand ── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 w-[46%] shrink-0 relative overflow-hidden bg-[var(--card)] shadow-[-2px_0_12px_rgba(0,0,0,0.06)]"
      >
        {/* Ambient glow */}
        <div
          className="absolute bottom-0 right-0 w-[500px] h-[400px] pointer-events-none opacity-40"
          style={{ background: "radial-gradient(ellipse at bottom right, rgba(223,178,108,0.2) 0%, transparent 65%)" }}
        />

        {/* Logo */}
        <div className="page-enter stagger-1">
          <VoyaraLogo size="md" href="/" />
        </div>

        {/* Mid content */}
        <div className="page-enter stagger-2">
          <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-4 text-[var(--gold)]">
            The Modern Way to Travel
          </p>
          <h2
            className="font-bold leading-[1.05] text-[var(--foreground)] mb-5 font-serif"
            style={{ fontSize: "clamp(2rem, 3.2vw, 2.8rem)" }}
          >
            Start your next<br />adventure together.
          </h2>
          <p className="text-[15px] text-[var(--foreground)]/60 leading-relaxed max-w-sm">
            Curated destinations, automatic scheduling buffers, interactive routing, and effortless group bill splitting.
          </p>
        </div>

        {/* Bottom feature list */}
        <div className="flex flex-col gap-4 page-enter stagger-3">
          {[
            { icon: MapPin, text: "Curated Destination Catalog" },
            { icon: Users, text: "Encrypted Group Passes" },
            { icon: Receipt, text: "Intelligent Debt Simplification" },
          ].map(({ icon: IconComponent, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--gold)]/10 border border-[var(--gold)]/20"
              >
                <IconComponent className="w-3.5 h-3.5 text-[var(--gold)]" />
              </div>
              <span className="text-sm text-[var(--foreground)]/70">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
