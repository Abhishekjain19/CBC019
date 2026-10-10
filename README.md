# Voyara - Comprehensive Travel Planner & Expense Tracker

Voyara is a full-featured, collaborative application designed to help individuals, families, and friend groups move from an initial destination idea to a practical, shareable itinerary, and seamlessly track trip spending and settle shared costs. The application combines place discovery, AI-assisted itinerary drafting, deterministic itinerary conflict checking, shared editing, and expense splitting into one responsive web app.

---

## 🌟 1. Product Overview & Core Problem

Trip planning is traditionally fragmented across map applications, blog posts, chat conversations, and spreadsheets. When traveling as a group, differing interests, limited budgets, and incompatible schedules complicate planning. Once the trip starts, recording expenses and calculating who owes whom becomes manual and error-prone.

**Voyara solves these problems by providing:**
*   **A single destination-specific workspace** for a trip.
*   **Place discovery** grounded in the app's internal places database.
*   **AI-drafted itineraries** evaluated by deterministic rules before confirmation.
*   **Shareable trips** via join codes for collaborative family and group trips.
*   **Comprehensive expense tracking**, budget-versus-actual views, group balances, and settle-up suggestions.

---

## 👥 2. User Personas & Use Cases

*   **Solo Traveller:** Plans practical itineraries without group coordination. Requires place discovery, itinerary management, and personal budget tracking.
*   **Family Organiser:** Coordinates shared plans and shared spending. Needs a shared itinerary, join links, member management, and budget tracking (pool of money).
*   **Friend-Group Organiser:** Aligns interests and tracks who paid for what. Uses shared itineraries, split rules, balance calculations, and settle-up payments.
*   **Trip Participant:** Joins via a code, views/edits the itinerary, adds expenses, and views group balances.

---

## 🛠️ 3. Technology Stack & Architecture

Voyara follows a **Modular Monolith** architecture deployed as a single application. The application strictly relies on server-side data operations; the browser connects to Next.js API/UI and Neon Auth UI without directly accessing the database.

*   **Frontend & Backend Framework:** [Next.js App Router](https://nextjs.org/) + TypeScript (Pages, Server Actions, Route Handlers)
*   **Styling & UI:** Tailwind CSS, shadcn/ui, Lucide Icons
*   **Database:** Neon PostgreSQL + PostGIS (for geospatial queries and nearby-place operations)
*   **ORM:** Drizzle ORM
*   **Authentication:** **Neon Auth** (Managed service for sign-in/sign-up and sessions). Custom schemas are not used for core identity.
*   **Client State Management:** TanStack Query
*   **Validation:** Zod (for request schemas and LLM response validation)
*   **Date/Time:** Luxon
*   **Maps & Routing:** MapLibre GL JS + OpenFreeMap tiles, OpenRouteService (ORS)
*   **AI/LLM Provider:** Google Gemini (via `@ai-sdk/google`)
*   **Deployment:** Vercel

### Architecture Diagram Flow
1.  **Browser** connects to Next.js and Neon Auth UI.
2.  **Next.js Server** receives requests and validates session identities via Neon Auth.
3.  **Domain Modules** (Trips, Places, Itinerary, Expenses) run on the server.
4.  **Drizzle ORM** queries the Neon PostgreSQL database.
5.  External Services (OpenRouteService, Gemini) are accessed via backend wrapper adapters.

---

## 🔐 4. Authentication & Security

*   **Neon Auth Ownership:** Neon Auth handles user identity, credentials, authentication endpoints, and sessions (using the `neon_auth` schema).
*   **App Profile Ownership:** The app's `profile` table stores the `user_id` (matching the Auth session), date of birth, and travel preferences.
*   **Zero-Trust:** Every trip-scoped read/write route runs a shared session + membership guard. Owner-only operations (e.g., locking an itinerary, regenerating join codes) enforce explicit owner checks.
*   **Secrets:** API keys, database URLs, and cookie secrets are kept in environment variables on the server. Only the Auth Base URL is exposed publicly (`NEXT_PUBLIC_NEON_AUTH_URL`).

---

## 🗺️ 5. Key System Features

### 5.1 Place Discovery & Selection
The platform seeds curated destinations via OpenStreetMap/Overpass. The app-owned database is queried for suggestions based on user vibe tags, pace, and destination, mitigating reliance on external live map APIs. Users can also add custom places via map pins.

### 5.2 AI Itinerary Generation Pipeline
1.  Users select places and define trip constraints (dates, daily hours, budget).
2.  The app resolves travel durations via `route_cache` or OpenRouteService (falling back to geometric straight-line estimates if ORS fails).
3.  An LLM prompt is constructed with **allow-listed place IDs** and sent to Gemini to write structured JSON descriptions and timing proposals for *one day per request*.
4.  The output is rigorously validated using Zod. The LLM is prohibited from inventing place IDs or authoritative route times.

### 5.3 Deterministic Conflict Checker
Pure domain code (not AI) runs a validation engine against the draft:
*   **Overlap:** Stop start/end times overlap.
*   **Closed Place:** Stop is scheduled outside known opening hours.
*   **Impossible Transfer:** Route duration exceeds the gap between consecutive stops.
*   **Day Too Long:** Stop timings exceed the trip's configured daily time window.
*   **Over Budget:** Estimated cost exceeds the total trip budget.

### 5.4 Sharing and Concurrency
*   Trips use a cryptographically secure 8-character join code.
*   Concurrent updates to itineraries and expenses are mitigated via **Optimistic Concurrency Control**. A version mismatch returns an HTTP `409 Conflict`, requiring the client to reconcile rather than silently overwrite data.

### 5.5 Expense Tracking and Settle-Up
*   All financial values are stored atomically in **integer paise** (`BIGINT`).
*   Expenses support "Equal" and "Exact" splits. For equal splits, remainder paise are assigned deterministically to the payer.
*   A pure deterministic minimal-payment suggestion engine matches the largest debtors and creditors to settle balances efficiently. Marking a settlement simply records acknowledgment without transferring real money.

---

## 🗄️ 6. Data Model / Database Schema

The core Drizzle schema includes:
*   `profile`: `user_id` (PK), display name, DOB, vibe tags, pace, budget level.
*   `trip`: `id` (UUID), `owner_id`, type, destination, dates, budget_paise, join_code, version.
*   `trip_member`: `trip_id`, `user_id`, role (owner/member).
*   `place`: `id`, name, category, PostGIS location point, opening_hours.
*   `itinerary`: `id`, `trip_id`, status, version.
*   `stop`: `id`, `itinerary_id`, `place_id`, start/end times, sort_order, cost_paise.
*   `route_cache`: origin_key, destination_key, mode, duration, distance.
*   `expense`: `id`, `trip_id`, payer_id, amount_paise, category, version.
*   `expense_split`: `expense_id`, `user_id`, share_paise.
*   `settlement`: `id`, `trip_id`, from_user, to_user, amount_paise, status.

---

## 💻 7. Local Development Setup

### 7.1 Prerequisites
*   Node.js (LTS version)
*   pnpm (Package Manager)
*   Git
*   Neon CLI

### 7.2 Configure Neon Database & Auth
1.  Install Neon CLI: `npm i -g neon@latest`
2.  Login to Neon: `neon login`
3.  Link your project: `neon link --project-id <YOUR_PROJECT_ID> --branch <YOUR_BRANCH> -y`
4.  Init config: `neon config init`
5.  Ensure `neon.ts` contains `auth: true`.

### 7.3 Environment Variables
Create `.env.local` based on `.env.example`. Do **NOT** commit `.env.local`.

```env
# Database Connections (Branch-Specific)
DATABASE_URL="postgres://..."
DATABASE_URL_UNPOOLED="postgres://..."

# Neon Auth Configuration (Branch-Specific)
NEON_AUTH_BASE_URL="https://..."
NEXT_PUBLIC_NEON_AUTH_URL="https://..."
NEON_AUTH_COOKIE_SECRET="<generate via: openssl rand -base64 32>"
NEON_AUTH_JWKS_URL="https://..."

# Third-Party API Keys
ORS_API_KEY="..."
LLM_PROVIDER="gemini"
LLM_API_KEY="..."

# Application URL
APP_URL="http://localhost:3000"
```

### 7.4 Installation & Running
```bash
# 1. Install dependencies
pnpm install

# 2. Push database schema (runs via DATABASE_URL_UNPOOLED)
pnpm run db:push

# 3. Seed Places data (requires tsx and seed scripts to be configured)
pnpm run seed

# 4. Start the development server
pnpm run dev
```

Visit `http://localhost:3000` to interact with the application.

---

## 🚀 8. Testing & QA Strategy

The application focuses on deep integrity tests:
1.  **Auth & Security:** Validate access denial for unauthenticated, non-member, and non-owner access.
2.  **Concurrency Checks:** Trigger simultaneous updates on the same itinerary version to confirm `409 Conflict` behavior.
3.  **Financial Mathematics:** Assert exactness of splits (integer paise), zero-sum remainders, and accurate minimal payment algorithms.
4.  **Resilience & Fallbacks:** Purposely invalidate ORS and LLM keys to ensure geometric route estimations and rule-based fallback itineraries trigger gracefully.

---
*Developed for the CBC 2.0 Hackathon.*