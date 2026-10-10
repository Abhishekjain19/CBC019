"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const TOTAL_FRAMES = 300;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const images: (HTMLImageElement | undefined)[] = new Array(TOTAL_FRAMES + 1);
    const loaded: boolean[] = new Array(TOTAL_FRAMES + 1).fill(false);

    let targetProgress = 0;
    let currentProgress = 0;
    let displayedFrame = -1;
    const LERP_SPEED = 0.12;

    const getFramePath = (index: number) => {
      const padded = String(index).padStart(3, "0");
      return `/images/ezgif-frame-${padded}.jpg`;
    };

    const getNearestLoaded = (index: number) => {
      if (loaded[index] && images[index]) return images[index];
      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = index - offset;
        if (prev >= 1 && loaded[prev] && images[prev]) return images[prev];
        const next = index + offset;
        if (next <= TOTAL_FRAMES && loaded[next] && images[next]) return images[next];
      }
      return null;
    };

    const renderFrame = (index: number, force = false) => {
      const img = getNearestLoaded(index);
      if (!img) return;

      if (!force && displayedFrame === index && img === images[index]) return;

      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      const bufferW = Math.round(width * dpr);
      const bufferH = Math.round(height * dpr);

      if (canvas.width !== bufferW || canvas.height !== bufferH) {
        canvas.width = bufferW;
        canvas.height = bufferH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const imgW = img.naturalWidth || 1280;
      const imgH = img.naturalHeight || 720;
      const scale = Math.max(width / imgW, height / imgH);

      const renderW = imgW * scale;
      const renderH = imgH * scale;
      const offsetX = (width - renderW) / 2;
      const offsetY = (height - renderH) / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
      ctx.restore();

      displayedFrame = index;
    };

    const setProgress = (val: number) => {
      targetProgress = Math.max(0, Math.min(1, val));
    };

    const onScroll = () => {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setProgress(scrollY / maxScroll);
    };

    const onWheel = (e: WheelEvent) => {
      const travelDistance = window.innerHeight * 4;
      setProgress(targetProgress + e.deltaY / travelDistance);
    };

    let lastTouchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) lastTouchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0 && lastTouchY !== null) {
        const curY = e.touches[0].clientY;
        const delta = lastTouchY - curY;
        lastTouchY = curY;
        setProgress(targetProgress + delta / (window.innerHeight * 3));
      }
    };
    const onTouchEnd = () => { lastTouchY = null; };

    let animationId: number;
    const loop = () => {
      const diff = targetProgress - currentProgress;
      if (Math.abs(diff) > 0.0001) {
        currentProgress += diff * LERP_SPEED;
      } else {
        currentProgress = targetProgress;
      }

      const frameIndex = Math.min(
        TOTAL_FRAMES,
        Math.max(1, Math.round(1 + currentProgress * (TOTAL_FRAMES - 1)))
      );

      renderFrame(frameIndex);

      // Navbar scroll state
      const navbarEl = document.getElementById("navbar");
      if (navbarEl) {
        if (currentProgress > 0.015) navbarEl.classList.add("scrolled");
        else navbarEl.classList.remove("scrolled");
      }

      // Landing hero fade out
      const landingHeroEl = document.getElementById("landingHero");
      const landingOverlayEl = document.getElementById("landingOverlay");
      const landingRatio = Math.min(1, currentProgress / 0.06);
      const landingOpacity = Math.max(0, 1 - landingRatio);

      if (landingHeroEl) {
        landingHeroEl.style.opacity = String(landingOpacity);
        landingHeroEl.style.transform = `translateY(${-landingRatio * 35}px)`;
        landingHeroEl.style.pointerEvents = landingOpacity <= 0.05 ? "none" : "auto";
        landingHeroEl.style.visibility = landingOpacity <= 0.01 ? "hidden" : "visible";
      }
      if (landingOverlayEl) {
        landingOverlayEl.style.opacity = String(landingOpacity);
        landingOverlayEl.style.visibility = landingOpacity <= 0.01 ? "hidden" : "visible";
      }

      // Ending hero fade in
      const endingHeroEl = document.getElementById("endingHero");
      const endingOverlayEl = document.getElementById("endingOverlay");
      const END_START = 0.85;
      let endingOpacity = 0;
      if (currentProgress >= END_START) {
        endingOpacity = Math.min(1, (currentProgress - END_START) / (1 - END_START));
      }

      if (endingHeroEl) {
        endingHeroEl.style.opacity = String(endingOpacity);
        endingHeroEl.style.transform = `translateY(${(1 - endingOpacity) * 35}px)`;
        endingHeroEl.style.pointerEvents = endingOpacity >= 0.8 ? "auto" : "none";
        endingHeroEl.style.visibility = endingOpacity <= 0.01 ? "hidden" : "visible";
      }
      if (endingOverlayEl) {
        endingOverlayEl.style.opacity = String(endingOpacity);
        endingOverlayEl.style.visibility = endingOpacity <= 0.01 ? "hidden" : "visible";
      }

      animationId = requestAnimationFrame(loop);
    };

    // Preload frames
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        loaded[i] = true;
        images[i] = img;
        if (i === 1 && displayedFrame === -1) renderFrame(1, true);
      };
      images[i] = img;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", () => {
      onScroll();
      renderFrame(Math.max(1, Math.round(1 + currentProgress * (TOTAL_FRAMES - 1))), true);
    });

    onScroll();
    animationId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div className="relative w-full min-h-[500vh] bg-black text-white" data-force-dark="true">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        id="canvas"
        className="fixed top-0 left-0 w-screen h-screen block pointer-events-none z-[1] bg-black"
      />

      {/* ── Minimal Navigation ── */}
      <header
        id="navbar"
        className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-10 py-5 pointer-events-auto transition-all duration-500"
        style={{ background: "transparent" }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-white drop-shadow">
          <svg className="w-6 h-5" viewBox="0 0 28 20" fill="none">
            <path d="M2 17L10 3L16 13L21 6L26 17H2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Voyara</span>
        </Link>

        {/* Auth actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-semibold text-white/85 hover:text-white transition-colors px-4 py-2 rounded-full hover:bg-white/10"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="bg-white text-slate-900 px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-100 transition-all shadow-lg"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── FIRST FRAME — Landing Section ── */}
      <div
        id="landingOverlay"
        className="fixed inset-0 pointer-events-none z-[2] transition-opacity duration-300"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)" }}
      />
      <div
        id="landingHero"
        className="fixed inset-0 z-10 flex flex-col justify-end px-12 pb-14 pt-24 pointer-events-none transition-all duration-300"
      >
        {/* Main content */}
        <div className="max-w-[680px] mb-10 pointer-events-auto">
          <h1
            className="font-extrabold tracking-tight leading-[1.04] mb-5 text-white drop-shadow-lg"
            style={{ fontSize: "clamp(2.6rem, 5.5vw, 3.75rem)" }}
          >
            Plan Trips<br />Beyond the Ordinary
          </h1>
          <p className="text-[15px] text-white/75 leading-relaxed max-w-[480px] mb-8">
            Day-by-day AI itineraries, collaborative group planning, and smart
            expense splitting — all in one place.
          </p>

          {/* CTAs — static links, not nav */}
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2.5 bg-white text-slate-900 px-7 py-3.5 rounded-full text-sm font-bold hover:bg-slate-100 transition-all shadow-xl hover:-translate-y-0.5 active:scale-95"
            >
              <span>Start for Free</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/25 text-white px-6 py-3.5 rounded-full text-sm font-semibold hover:bg-white/20 transition-all backdrop-blur-md"
            >
              Sign In to Your Account
            </Link>
          </div>
        </div>

        {/* Feature CTA Cards */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 pointer-events-auto">
          {[
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 21s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z" />
                </svg>
              ),
              label: "Curated Destinations",
              sub: "Iconic places, handpicked",
            },
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              ),
              label: "AI Itineraries",
              sub: "Day-by-day, AI-drafted",
            },
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
              label: "Group Collaboration",
              sub: "Plan together, in sync",
            },
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M6 12h.01M18 12h.01" />
                </svg>
              ),
              label: "Smart Expense Split",
              sub: "Fair splits, to the paise",
            },
          ].map(({ icon, label, sub }) => (
            <div
              key={label}
              className="feature-card flex flex-col gap-3 rounded-2xl px-4 py-4 backdrop-blur-sm"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{label}</p>
                <p className="text-[11px] text-white/70 mt-1 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ── LAST FRAME — Ending Section ── */}
      <div
        id="endingOverlay"
        className="fixed inset-0 pointer-events-none z-[2] opacity-0 invisible transition-all duration-300"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.08) 100%)" }}
      />
      <div
        id="endingHero"
        className="fixed inset-0 z-10 flex flex-col justify-end px-12 pb-14 pt-24 pointer-events-none opacity-0 invisible transition-all duration-300"
      >
        <div className="max-w-[680px] mb-10 pointer-events-auto">
          <h2 className="mb-5">
            <span
              className="block font-bold leading-none text-white drop-shadow-xl"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(3rem, 7vw, 5.5rem)" }}
            >
              Luxury
            </span>
            <span
              className="block font-medium text-white/85 mt-2 drop-shadow-md"
              style={{ fontSize: "clamp(1.15rem, 2.5vw, 1.75rem)" }}
            >
              Journeys that feel extraordinary.
            </span>
          </h2>
          <p className="text-[15px] text-white/75 leading-relaxed max-w-[500px] mb-8">
            Handpicked destinations, curated stays, and unique experiences.
            Your next unforgettable journey starts here.
          </p>

          {/* CTAs — static links, not nav */}
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 bg-white text-slate-900 px-7 py-3.5 rounded-full text-sm font-bold hover:bg-slate-100 transition-all shadow-xl hover:-translate-y-0.5 active:scale-95"
            >
              <span>Open Dashboard</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center gap-2 border text-white px-6 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all backdrop-blur-md"
              style={{ borderColor: "rgba(223,178,108,0.45)", color: "#f0d090" }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Join a Trip</span>
            </Link>
          </div>
        </div>

        {/* Feature CTA Cards — gold accent */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 pointer-events-auto">
          {[
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 21s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z" />
                </svg>
              ),
              label: "Curated Destinations",
              sub: "Iconic places, handpicked",
            },
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
              ),
              label: "Personalised Itineraries",
              sub: "Trips tailored to you",
            },
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
                </svg>
              ),
              label: "Stays & Experiences",
              sub: "Best stays, local highlights",
            },
            {
              icon: (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M6 12h.01M18 12h.01" />
                </svg>
              ),
              label: "Fair Expense Split",
              sub: "Integer paise precision",
            },
          ].map(({ icon, label, sub }) => (
            <div
              key={label}
              className="feature-card flex flex-col gap-3 rounded-2xl px-4 py-4 backdrop-blur-sm"
              style={{
                background: "rgba(223,178,108,0.07)",
                border: "1px solid rgba(223,178,108,0.18)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(223,178,108,0.14)", color: "#dfb26c" }}
              >
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">{label}</p>
                <p className="text-[11px] text-white/70 mt-1 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
