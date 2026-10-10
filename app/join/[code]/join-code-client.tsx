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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 selection:bg-[#dfb26c]/30">
      <Link
        href="/"
        className="flex items-center gap-3 font-extrabold text-xl tracking-tight text-white mb-10 page-enter stagger-1 group"
      >
        <div className="w-8 h-8 rounded-xl bg-[#dfb26c]/15 border border-[#dfb26c]/40 flex items-center justify-center text-[#dfb26c] transition-transform group-hover:scale-105">
          <Compass className="w-4 h-4 text-[#dfb26c]" />
        </div>
        <span className="font-serif tracking-wide text-2xl text-white">Voyara</span>
      </Link>

      <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl text-center page-enter stagger-2">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[#dfb26c]/15 border border-[#dfb26c]/40 flex items-center justify-center text-[#dfb26c] shadow-[0_0_30px_rgba(223,178,108,0.2)]">
          <Ticket className="w-6 h-6 text-[#dfb26c]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dfb26c]/10 border border-[#dfb26c]/25 text-[#dfb26c] text-xs font-semibold tracking-wide mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Trip Invitation
        </div>

        <h1 className="text-2xl sm:text-3xl font-serif text-white tracking-tight">
          You&apos;re Invited to Join
        </h1>
        <p className="text-xs sm:text-sm text-white/50 mt-1.5">
          Connect with your group&apos;s live schedule, places, and shared splits.
        </p>

        <div className="my-6 p-4 rounded-xl bg-black/60 border border-white/[0.1] flex items-center justify-center gap-3">
          <span className="text-[11px] text-white/40 uppercase font-mono tracking-wider">PASSCODE:</span>
          <span className="font-mono text-xl font-bold tracking-[0.25em] text-[#dfb26c]">
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
          className="btn-press w-full py-3.5 rounded-xl bg-[#dfb26c] text-black font-semibold text-sm tracking-wide shadow-lg shadow-[#dfb26c]/20 hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 mb-4"
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
          className="text-xs text-white/40 hover:text-white/70 transition flex items-center justify-center gap-1"
        >
          ← Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
