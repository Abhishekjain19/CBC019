"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({
  className = "",
  fixed = true,
}: {
  className?: string;
  fixed?: boolean;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("voyara-theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("voyara-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  if (!mounted || pathname === "/") {
    return null;
  }

  const baseClasses = fixed
    ? "fixed bottom-6 right-6 z-[9999] w-12 h-12 rounded-full bg-[var(--card)]/90 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)] border border-[var(--foreground)]/10 hover:border-[var(--gold)]/60 hover:scale-105 active:scale-95 transition-all duration-300 group flex items-center justify-center"
    : `btn-press w-9 h-9 rounded-xl bg-[var(--card)] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(223,178,108,0.25)] dark:shadow-[0_2px_12px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_4px_16px_rgba(223,178,108,0.15)] text-[var(--foreground)] flex items-center justify-center transition-all ${className}`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${baseClasses} ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-[var(--gold)] transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-[var(--gold)] transition-transform duration-300 group-hover:-rotate-12" />
      )}
      {fixed && (
        <span className="sr-only">
          Toggle {theme === "dark" ? "light" : "dark"} mode
        </span>
      )}
    </button>
  );
}

export default ThemeToggle;
