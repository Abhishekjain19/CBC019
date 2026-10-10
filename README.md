# Voyara - Travel Planner & Expense Tracker

Voyara is a comprehensive application that helps individuals and groups plan trips, discover places, draft itineraries using AI, and manage shared expenses seamlessly. It moves you from an initial destination idea to a practical, shareable itinerary, and finally to tracking trip spending and settling shared costs.

## Features

*   **Trip Planning & Discovery**: Create solo, family, or group trips. Discover and suggest places based on an internal curated database.
*   **AI-Assisted Itineraries**: Generate day-by-day itineraries using Gemini (or a configured LLM). The AI uses allow-listed place IDs to ensure factual accuracy and practical planning.
*   **Deterministic Conflict Checker**: Automatically detects overlaps, closed places, impossible transfers, over-budget plans, and provides actionable suggested fixes.
*   **Collaboration & Sharing**: Share trips with a secure join code. Trip members can collaboratively view and edit drafts, and add expenses.
*   **Expense Tracking & Settle Up**: Record expenses in integer paise, view budget-versus-actual spending, and compute group running balances with minimum-payment settle-up suggestions.
*   **Robust Security & Authentication**: Secure sign-up/sign-in flows via **Neon Auth**, with server-side membership and role guards protecting all trip data.

## Technology Stack

*   **Framework**: [Next.js App Router](https://nextjs.org/) + TypeScript
*   **Database**: [Neon PostgreSQL](https://neon.tech/) + PostGIS (for geospatial queries)
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
*   **Authentication**: Neon Auth (managed identity and sessions)
*   **UI & Styling**: [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), Lucide Icons
*   **Maps & Routing**: MapLibre GL JS + OpenFreeMap tiles, OpenRouteService (ORS)
*   **AI/LLM**: Google Gemini (via `@ai-sdk/google`)
*   **Deployment**: Vercel

## Architecture

Voyara follows a **Modular Monolith** architecture deployed as a single Next.js application on Vercel. 
*   **Frontend**: Browser connects to Next.js API/UI and Neon Auth UI.
*   **Backend**: Next.js Server Components, Server Actions, and Route Handlers interact with the database via Drizzle and validate sessions with Neon Auth.
*   **Data Model**: Application-specific data (Trips, Places, Itineraries, Expenses) resides in app-owned Drizzle schema, separate from Neon's managed `neon_auth` schema.

## Local Development Setup

### 1. Prerequisites
*   Node.js (LTS)
*   pnpm
*   Neon CLI

### 2. Configure Neon Database & Auth
Ensure your Neon project has Neon Auth enabled. 
1.  Run `neon login` and `neon link --project-id <YOUR_PROJECT_ID> --branch <YOUR_BRANCH>`
2.  Initialize configuration with `neon config init`.

### 3. Environment Variables
Create a `.env.local` file with the following variables based on your branch and providers:

```env
# Database Connections
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Neon Auth Configuration
NEON_AUTH_BASE_URL=
NEXT_PUBLIC_NEON_AUTH_URL=
NEON_AUTH_COOKIE_SECRET= # Generate with: openssl rand -base64 32

# Third-Party Providers
ORS_API_KEY=
LLM_PROVIDER=gemini
LLM_API_KEY=

# App
APP_URL=http://localhost:3000
```

### 4. Install & Run
```bash
# Install dependencies
pnpm install

# Push database schema (uses unpooled connection)
pnpm run db:push

# Run the development server
pnpm run dev
```

Navigate to `http://localhost:3000` to view the application.

## Non-Functional Requirements & Safety
*   **Fallback Resilience**: The app utilizes straight-line estimations and rule-based fallback itineraries if external routing or AI APIs fail.
*   **Concurrency**: Uses optimistic version checks (`409 Conflict`) to prevent stale overwrites on shared trips.
*   **Data Integrity**: Money is strictly calculated and stored in integer paise. Expense and splits are committed in single transactions.