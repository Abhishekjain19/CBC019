"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ticket, ArrowRight, ShieldCheck } from "lucide-react";
import VoyaraLogo from "@/components/voyara-logo";
import ThemeToggle from "@/components/theme-toggle";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);

  // Format input: uppercase, max 8 chars
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase().slice(0, 8));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 8) {
      router.push(`/join/${code}`);
    }
  };

  const filled = code.length;

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center justify-center px-6 relative overflow-hidden selection:bg-[var(--gold)]/30">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 700px 500px at 50% 110%, rgba(223,178,108,0.09) 0%, transparent 70%)" }}
      />

      {/* Logo */}
      <div className="mb-12 page-enter stagger-1">
        <VoyaraLogo href="/" textClassName="text-2xl font-bold" />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[430px] rounded-3xl p-8 sm:p-10 relative page-enter stagger-2"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border-subtle)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 mx-auto"
          style={{ background: "rgba(223,178,108,0.12)", border: "1px solid rgba(223,178,108,0.25)" }}
        >
          <Ticket className="w-6 h-6 text-[var(--gold)]" />
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/25 text-[var(--gold)] text-[11px] font-semibold tracking-wide mb-2.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Trip Pass
          </div>
          <h1 className="text-2xl font-serif font-extrabold text-[var(--foreground)] tracking-tight mb-2">Join a Journey</h1>
          <p className="text-xs sm:text-sm text-[var(--foreground)]/55 leading-relaxed">
            Enter the 8-character invite code<br />shared by your trip organizer.
          </p>
        </div>

        {/* Code input */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="join-code-input" className="block text-[11px] font-semibold uppercase tracking-widest text-[var(--foreground)]/50 text-center">
              Invite Code
            </label>
            <input
              id="join-code-input"
              type="text"
              value={code}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoComplete="off"
              spellCheck={false}
              placeholder="VOYARA26"
              className="w-full rounded-xl px-4 py-3.5 text-center text-2xl font-bold tracking-[0.35em] text-[var(--foreground)] placeholder-[var(--foreground)]/15 uppercase font-mono"
              style={{
                background: "var(--surface-1)",
                border: `1px solid ${focused ? "rgba(223,178,108,0.5)" : "var(--border-subtle)"}`,
                boxShadow: focused ? "0 0 0 3px rgba(223,178,108,0.1)" : "none",
                transition: "border-color 180ms cubic-bezier(0.16,1,0.3,1), box-shadow 180ms cubic-bezier(0.16,1,0.3,1)",
              }}
            />

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-150"
                  style={{
                    width: i < filled ? "8px" : "6px",
                    height: i < filled ? "8px" : "6px",
                    background: i < filled ? "var(--gold)" : "var(--border-subtle)",
                    transform: i < filled ? "scale(1.1)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          <button
            id="join-submit"
            type="submit"
            disabled={filled < 8}
            className="btn-press w-full py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
            style={{
              background: filled === 8 ? "var(--gold)" : "var(--surface-2)",
              color: filled === 8 ? "#000" : "var(--text-muted)",
              cursor: filled === 8 ? "pointer" : "not-allowed",
              boxShadow: filled === 8 ? "0 0 20px rgba(223,178,108,0.2)" : "none",
              transition: "background 0.22s cubic-bezier(0.16,1,0.3,1), color 0.22s ease, transform 140ms ease",
            }}
          >
            <span>Access Workspace</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-[var(--border-subtle)] text-center">
          <p className="text-xs sm:text-sm text-[var(--foreground)]/40">
            Planning your own escape?{" "}
            <Link href="/trips/new" className="text-[var(--gold)] font-semibold hover:underline">
              Create a trip
            </Link>
          </p>
        </div>
      </div>

      {/* Back link */}
      <Link
        href="/dashboard"
        className="mt-8 text-xs text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70 transition-colors flex items-center gap-1.5 page-enter stagger-3"
      >
        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
        Return to Dashboard
      </Link>
    </div>
  );
}
