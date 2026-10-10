# Product Requirements Document (PRD)

**Product:** Travel Planner + Expense Tracker (Voyara)  
**Release target:** CBC 2.0 hackathon demo  
**Document status:** Implementation baseline v3  
**Frontend/backend framework:** Next.js App Router + TypeScript  
**Database and authentication:** Neon PostgreSQL + Neon Auth  
**Deployment target:** Vercel  

---

## 1. Executive summary

The product helps a traveller or a group move from an initial destination idea to a practical, shareable itinerary, then track trip spending and settle shared costs. The application combines place discovery, AI-assisted itinerary drafting, deterministic itinerary checks, shared editing, and expense splitting in one responsive web app.

**Authentication decision:** use **Neon Auth** for identity, sign-in/sign-up, sessions, and auth endpoints. Do not build or deploy a separate Better Auth server and do not install the `better-auth` package as the application's auth implementation. Use Neon's supported SDK and Next.js integration. The app's own profile and trip data remain in application tables in Neon PostgreSQL.

## 2. Problem statement

Trip planning is fragmented across map applications, blog posts, chat conversations, and spreadsheets. Group members may have different interests, limited budgets, or incompatible schedules. Once the trip starts, recording expenses and calculating who owes whom becomes manual and error-prone.

The app addresses these problems by providing:

- One destination-specific workspace for a trip.
- Place suggestions grounded in the app's places database.
- An AI-drafted itinerary that is checked by deterministic rules before confirmation.
- A shareable trip and join-code flow for family and group trips.
- Expense tracking, budget-versus-actual views, balances, and suggested settlement payments.

## 3. Product goals and measures of success

### 3.1 Hackathon goals

1. A new user can complete authentication, preferences, and trip creation without developer assistance.
2. The user can discover places and generate the first itinerary day in approximately 10 seconds under normal demo conditions, with fallback behaviour when external services fail.
3. The itinerary uses only place records selected from the database; the AI cannot invent place IDs or authoritative travel durations.
4. A family/group trip can be shared through a link or join code, and a newly authenticated participant can join.
5. A group can record expenses, see budget-versus-actual spending, compute balances, and view a minimum-payment settle-up suggestion.
6. All critical flows work in a responsive desktop and mobile browser.
7. The application is deployable on the existing Neon project and Vercel without adding a separate auth server or email provider.

### 3.2 Demo success criteria

The demo should show the complete path:

1. Sign up or sign in using Neon Auth.
2. Save basic profile preferences.
3. Create a trip with destination, dates, travel mode, and budget.
4. View suggested places and select stops.
5. Generate an itinerary draft.
6. Show at least one conflict and its suggested fix, or show why a clean itinerary passes validation.
7. Confirm the itinerary and share the join link/code.
8. Join the same trip with a second account.
9. Record an expense, view balances, and mark a suggested settlement as recorded.

A pre-created demo account and demo trip should be available as a backup. Create the demo user through Neon Auth and seed only the app-owned records; never create fake rows in Neon's managed auth schema.

## 4. Users and primary needs

| Persona | Primary need | Important capabilities |
|---|---|---|
| Solo traveller | Plan a practical itinerary without group coordination | Preferences, place discovery, itinerary, budget and personal expenses |
| Family organiser | Coordinate a shared plan and shared spending | Shared itinerary, join link, member management, budget tracking |
| Friend-group organiser | Align interests and track who paid for what | Shared itinerary, member collaboration, split rules, balances, settle-up |
| Trip participant | Understand the plan and contribute data | Join a trip, view/edit the itinerary, add expenses, view group balances |

## 5. Scope and priorities

### 5.1 Core: must be implemented

- Neon Auth integration: sign up, sign in, sign out, and protected-session handling.
- Profile onboarding: display name, date of birth, vibe tags, pace, and budget level.
- Solo, family, and group trip creation.
- Place search and suggestion labels based on stored data.
- Manual custom-place entry with a map pin.
- AI-assisted day-by-day itinerary draft using known place IDs.
- Routing lookup and caching, with approximate straight-line fallback.
- Itinerary editor, deterministic conflict checking, and confirmation.
- Family/group join link and code, join flow, member removal, and code regeneration.
- Expense recording, category totals, budget-versus-actual, group splits, balances, and settle-up.
- Version checks for itinerary and expense edits.
- Basic demo seeding, error handling, responsive UI, and security checks.

### 5.2 Stretch: only after core acceptance criteria pass

- Manual check-ins and status updates with polling.
- Simple itinerary branches where a member skips a stop and optionally chooses an alternative.
- A trip summary page.
- Weather information, which must disappear gracefully if its provider fails.
- Per-trip overrides of the profile's default preferences.
- Expense edit/delete audit history.

### 5.3 Explicitly out of scope for the hackathon

- Separate self-hosted Better Auth server or custom password storage.
- An external email provider for verification, reset, or invites.
- Flight, train, bus, or hotel booking; live transit status.
- Moving money, payment gateway integration, or financial account linking.
- Continuous GPS tracking, WebSockets, push notifications, offline/PWA support, or native apps.
- Full multi-city route optimisation, full OSM/Overture ingestion, unrestricted AI replanning, or full itinerary branching.
- Viewer role, production-grade monitoring, or a comprehensive legal/privacy workflow. These remain post-hackathon hardening items.

## 6. Product experience and pages

| Page / route | Priority | Required behaviour |
|---|---|---|
| Landing page | Core | Existing page; CTAs navigate to Neon Auth sign-up/sign-in |
| Sign up / sign in | Core | Use Neon Auth SDK/UI and managed sessions; no app-owned password tables |
| Preferences onboarding | Core | Save display name, date of birth, vibe tags, pace, and budget level to the app profile |
| Dashboard | Core | List trips available to the current user and provide Create Trip action |
| Create trip | Core | Capture trip type, destination, dates, number of people, daily time window, transport, budget, and timezone if needed |
| Place discovery | Core | Search and suggest stored places with explicit reason labels |
| Itinerary builder | Core | Show a day timeline and map; add/remove/reorder stops and edit timing/cost/notes |
| Conflict panel | Core | Display severity, affected stops, explanation, and suggested fix |
| Trip overview | Core | Show members, confirmed plan, budget summary, share link, and join code where applicable |
| Join (`/join/[code]`) | Core | Require authentication; resume joining after sign-up/sign-in; show clear invalid/expired code state |
| Expenses | Core | Record/list expenses and budget-versus-actual by category |
| Split and settle | Core for group trips | Display member balances and suggested minimum-payment transfers; record settlement status only |
| Check-ins/status | Stretch | Manual check-in/status with last-updated timestamp; polling, not GPS tracking |
| Trip summary | Stretch | Summarise places, spend, budget variance, and per-person totals |
| Profile | Core | View/update preferences; profile edit UX may be minimal for the hackathon |

## 7. Product rules and invariants

### 7.1 Trip type

| Trip type | Join link | Expense tracking | Split bill |
|---|---|---|---|
| Solo | No | Yes | No |
| Family | Yes | Yes, shared expense pool | No individual settle-up in the core release |
| Group | Yes | Yes | Yes |

### 7.2 Roles

- **Owner:** edit trip-level settings, confirm/reopen itinerary, generate or regenerate join code, remove members, and perform member-management actions.
- **Member:** view and edit the shared draft, add expenses, and participate in group expense splitting.
- Viewer role is not part of the hackathon release.
- The server must enforce role permissions. Hiding a button in the UI is not an authorization control.

### 7.3 Place and itinerary integrity

- Every itinerary stop must reference a valid `place.id` in the app's `place` table.
- The AI receives an allow-list of selected place IDs and may not create place records or invent IDs.
- Route duration/distance comes from the routing wrapper or a clearly labelled approximation, not from the LLM.
- Unknown opening hours create a warning, not an automatic error.
- A confirmed itinerary is locked against member edits. The owner must explicitly reopen it before changes can be saved.

### 7.4 Money and expenses

- Persist all amounts as integer paise (`BIGINT` where totals may grow); convert to rupees only for display.
- Store an expense and all of its split rows atomically.
- For equal splits, distribute remainder paise deterministically to the payer, and require the payer to be among participants for this rule.
- For exact splits, the split shares must add up to the expense amount exactly.
- Settlement entries record an acknowledgement/status only. They do not initiate or represent a real payment.

### 7.5 Join codes and concurrency

- Use a cryptographically secure, random 8-character code from an unambiguous character set.
- A regenerated code immediately invalidates the previous code.
- Join attempts must handle invalid codes, removed users, already joined users, and trips that are not eligible for sharing.
- Updates include the last-seen version. A version mismatch returns a conflict response and asks the client to reload/reconcile rather than silently overwrite another user's change.

### 7.6 Place-suggestion labels

- Labels such as “matches your beach interest” must derive from a known matching rule.
- “Popular” must derive from an explicit stored score or documented formula.
- Never label a place “trending” without time-series evidence supporting that claim.
- Store source and image attribution/licence metadata when known.

## 8. Functional requirements summary

### 8.1 Identity and profile

- Use Neon Auth for identity and session flows.
- The app profile stores `user_id` matching the Neon Auth session user ID, plus date of birth and travel preferences.
- The app does not store password hashes, sessions, auth accounts, or verification tokens in its own schema.
- The exact email-verification behaviour must follow the configured Neon Auth policy for the selected branch; no external SMTP/Resend integration is part of this release.

### 8.2 Trip planning and discovery

- Validate trip date order and required trip fields.
- Use a single destination per trip for the hackathon demo.
- Seed two or three destinations with curated place data and allow manual custom-place creation.
- Suggestions and place search query the app's own table; the live app must not depend on Overpass availability.

### 8.3 Itinerary generation and editing

- Generate one day per request to reduce timeout and rate-limit risk.
- Route calculation follows cache-first behaviour.
- Send structured JSON output through Zod validation; retry once for malformed output, then use deterministic fallback.
- Run the conflict checker after every generated or edited plan.
- Confirmation is permitted only if blocking conflicts are resolved or explicitly allowed under defined override rules. Unknown-hours warnings can be overridden.

### 8.4 Collaboration and expenses

- Every trip-scoped API checks that the authenticated user is an active member.
- Owner-only endpoints separately validate the owner role.
- Group expense balances are recomputed from expense splits and recorded settlements.
- The settle-up view proposes payments that minimise the number of transfers using a deterministic debtor/creditor matching algorithm.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Aim to return the first itinerary day in about 10 seconds under normal demo conditions; show progress and use fallback when provider latency exceeds the request budget |
| Availability | Core flow remains usable if the LLM or routing API fails; place search works from the seeded database |
| Mobile | Responsive layout suitable for phone-based judging |
| Security | Neon Auth-managed sessions; server-side membership/role checks; Zod validation; secrets only in environment variables; no secrets in client bundles or Git |
| Data integrity | Integer paise; transactions for expense plus splits; optimistic concurrency for itinerary/expense edits |
| AI safety | Validate model output against schema and allowed IDs; do not treat generated text as authoritative place, opening-hours, route, or price data |
| Privacy | Collect only required profile/trip data; no continuous location tracking; do not expose date of birth in public trip views |
| Maintainability | Provider wrappers for LLM, routing, and weather; pure functions for conflict checks and money calculations |
| Demo resilience | Cached place/route data, deterministic fallback itinerary, one seeded demo trip, and a manual end-to-end rehearsal |

## 10. Acceptance criteria for core release

1. A user can sign up and sign in through Neon Auth; logout invalidates the app session as expected.
2. Protected pages and API endpoints reject unauthenticated requests.
3. A user can create a profile and trip; invalid date ranges and negative budgets are rejected.
4. Search and suggestions return only place records from the application's database.
5. Itinerary generation rejects unknown place IDs and uses routing data/cache or labelled estimates for travel duration.
6. The conflict checker identifies overlapping stops, known closure, impossible transfers, overlong days, and over-budget plans, and gives a suggested fix for each conflict.
7. A stale itinerary or expense update returns a version conflict instead of overwriting newer data.
8. A second authenticated user can join a family/group trip with a valid code; regenerated codes no longer work.
9. A non-member cannot read or mutate a trip by guessing its ID.
10. Expense split shares sum exactly to the expense total; equal-split remainder logic is deterministic.
11. The settlement proposal leaves each member's net balance correct, and marking a settlement changes its recorded status without transferring money.
12. The app still demonstrates place discovery and a fallback itinerary when the LLM or routing provider is unavailable.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM rate limit or malformed output | Per-user generation cap, one retry, cache demo itinerary, deterministic fallback |
| Routing quota or network failure | Cache route results and show straight-line estimates as approximate |
| Sparse destination data | Seed curated place records for two or three demo destinations; provide custom-place flow |
| Neon cold start | Warm the app/database before the demo and show a loading/retry state |
| Authentication settings differ by branch | Verify Neon Auth configuration and URL for the exact branch before testing signup/sign-in |
| Demo account cannot be seeded like an app record | Create demo user through Neon Auth, then seed app data using that user's real auth ID |
| Scope creep | Freeze core scope before implementing stretch features |
| Venue connectivity | Test on a phone hotspot and keep a recorded demo as backup |

## 12. Implementation order

1. Confirm the landing page framework and Neon project/branch configuration.
2. Integrate Neon Auth and secure route/session handling; wire landing CTAs.
3. Define app-owned Drizzle schema and migrations, then profile onboarding.
4. Implement trip creation, place seed/search/suggestions, and custom places.
5. Implement route cache, deterministic itinerary logic, LLM wrapper, and schema validation.
6. Implement conflict checks, editor, optimistic version checks, and confirmation.
7. Implement join-code sharing, membership guards, and owner actions.
8. Implement expenses, exact/equal splits, balances, and settle-up.
9. Seed demo data, run tests, deploy to Vercel, and rehearse the end-to-end flow.
10. Only after acceptance criteria pass, consider stretch features.

## 13. Decisions carried forward / open choices

- **Project and branch:** use the Neon project/production branch stated in `got_requirements`; use a separate development branch for local/preview work if available.
- **Destination coverage:** choose two or three destinations and curate their records before demo day.
- **LLM provider:** use Gemini if its key is configured; keep the provider wrapper swappable.
- **Timezone:** store a destination IANA timezone (or a documented default) so stop times are interpreted consistently.
- **Age policy:** do not infer or enforce an 18+ policy until the team confirms the requirement. Date of birth is a profile field for this hackathon, not a public field.

