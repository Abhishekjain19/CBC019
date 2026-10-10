---
name: gsd
description: >-
  Get Shit Done (GSD) — a spec-driven, context-aware development workflow for
  this project. Enforces structured planning, task breakdown, and iterative
  delivery with built-in quality gates.
---

# GSD — Get Shit Done Workflow

## Philosophy
Structure work into: Spec ? Plan ? Execute ? Review

## Project Context — Voyara

**Product:** Voyara — Travel Planner & Expense Tracker  
**Stack:** Next.js App Router + TypeScript + Tailwind CSS  
**DB:** Neon PostgreSQL (Drizzle ORM) | **Auth:** Neon Auth | **Deploy:** Vercel

### Key Pages
| Route | Purpose |
|---|---|
| `/` | Landing page with scroll animation |
| `/sign-in` | Neon Auth sign-in |
| `/sign-up` | Neon Auth sign-up + preferences |
| `/dashboard` | User trip list + create trip |
| `/trips/[id]` | Trip detail: itinerary, members, expenses |
| `/join/[code]` | Join a shared trip |

### Design Rules
- First frame CTA: Sign Up + Sign In (link to auth pages)
- Last frame CTA: Go to Dashboard + Join a Trip (link to pages)
- Nav: Voyara logo + Sign In + Sign Up buttons only
- Colors: dark slate/black bg, gold (#dfb26c) accents
- Font: Plus Jakarta Sans (body), Playfair Display (headlines)

## Quality Gates
1. TypeScript compiles without errors
2. No hardcoded secrets
3. Money stored as integer paise
4. All API routes check auth + membership
5. Canvas scroll animation preserved
