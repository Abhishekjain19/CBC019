import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voyara — Travel Planner & Expense Tracker",
  description: "AI-assisted day-by-day itineraries, group collaboration, and automated expense splitting.",
};

import ThemeToggle from "@/components/theme-toggle";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-black text-white">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
