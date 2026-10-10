"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Compass, Ticket, ArrowRight, ShieldCheck } from "lucide-react";

export default function JoinCodeClient({ code }: { code: string }) {
  const router = useRouter();
  const [cleanCode] = useState(code.toUpperCase());
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || data.requiresAuth) {
          router.push(`/sign-in?redirect=/join/${cleanCode}`);
          return;
        }
        throw new Error(data.error || "Failed to join trip");
      }

      router.push(`/trips/${data.tripId}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired join code");
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col items-center justify-center p-6 selection:bg-[var(--gold)]/30 transition-colors duration-300">
      <Link
        href="/"
        className="flex items-center gap-3 font-extrabold text-xl tracking-tight text-[var(--foreground)] mb-10 page-enter stagger-1 group"
      >
        <div className="w-8 h-8 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 flex items-center justify-center text-[var(--gold)] transition-transform group-hover:scale-105">
          <Compass className="w-4 h-4 text-[var(--gold)]" />
        </div>
        <span className="font-serif tracking-wide text-2xl text-[var(--foreground)]">Voyara</span>
      </Link>

      <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-[var(--card)] card-craft-md backdrop-blur-xl text-center page-enter stagger-2 border border-[var(--border-subtle)]">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[var(--gold)]/15 border border-[var(--gold)]/40 flex items-center justify-center text-[var(--gold)] shadow-[var(--shadow-gold)]">
          <Ticket className="w-6 h-6 text-[var(--gold)]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--gold)]/10 border border-[var(--gold)]/25 text-[var(--gold)] text-xs font-semibold tracking-wide mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Trip Invitation
        </div>

        <h1 className="text-2xl sm:text-3xl font-serif text-[var(--foreground)] tracking-tight">
          You&apos;re Invited to Join
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1.5">
          Connect with your group&apos;s live schedule, places, and shared splits.
        </p>

        <div className="my-6 p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] flex items-center justify-center gap-3">
          <span className="text-[11px] text-[var(--text-subtle)] uppercase font-mono tracking-wider">PASSCODE:</span>
          <span className="font-mono text-xl font-bold tracking-[0.25em] text-[var(--gold)]">
            {cleanCode}
          </span>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={handleJoin}
          disabled={isJoining}
          className="btn-press w-full py-3.5 rounded-xl bg-[var(--gold)] text-black font-semibold text-sm tracking-wide shadow-lg shadow-[var(--gold)]/20 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 mb-4"
        >
          {isJoining ? (
            <>
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Synchronizing Workspace...
            </>
          ) : (
            <>
              <span>Accept Invite & Enter Workspace</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </>
          )}
        </button>

        <Link
          href="/dashboard"
          className="text-xs text-[var(--text-subtle)] hover:text-[var(--text-muted)] transition flex items-center justify-center gap-1"
        >
          ← Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
