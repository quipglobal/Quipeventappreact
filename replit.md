# CXO Inc. Event Companion App

## Project Status: Both Apps De-mocked — All Live Backend Endpoints

The mobile app is feature-complete and App Store ready. Run `eas build --profile production --platform all` to produce a signed `.ipa` and `.aab`.

## Project Overview

Full-stack event companion platform with:
- **Web App**: React + Vite + TypeScript (original web UI, runs on port 5000)
- **Mobile App**: React Native (Expo SDK 52) with Expo Router (runs on port 8080 / Expo Go QR)

The mobile app is the primary product being developed. The web app at the root is the original reference implementation.

---

## Mobile App (Primary)

**Location**: `/mobile/`

### Tech Stack
- **Framework**: React Native 0.76.3 + TypeScript
- **Navigation**: Expo Router v4 (file-based routing)
- **UI**: Custom dark cinematic theme, LinearGradient, Ionicons
- **State**: React Context (AuthContext with gamification)
- **API**: Custom fetch client — all endpoints live, no mock data (`EXPO_PUBLIC_USE_MOCK_API=false` always)
- **Storage**: AsyncStorage (auth token)

### Architecture

```
mobile/
  app/
    _layout.tsx         - Root stack layout (fonts, providers, SplashScreen)
    index.tsx           - Auth gate → redirect to (auth) or (tabs)
    profile.tsx         - Profile modal screen
    +not-found.tsx      - 404 screen
    (auth)/
      welcome.tsx       - Phone OTP login + registration
    (tabs)/
      _layout.tsx       - Role-aware bottom tabs (attendee vs sponsor)
      feed.tsx          - Video/poll feed with live interactions
      audience.tsx      - Searchable attendee directory
      engage.tsx        - Gamification (attendee) / Sponsor tools (QR+leads+draw)
      agenda.tsx        - Session schedule with bookmarking
      partners.tsx      - Sponsor showcase with meeting booking
  components/
    auth/
      WelcomeScreen.tsx - Complete phone OTP auth UI
      OtpInput.tsx      - Custom 6-digit OTP input
    ErrorBoundary.tsx   - Global error boundary
    ToastNotification.tsx - Points toast animation
  constants/
    theme.ts            - Colors, spacing, radius, typography
  context/
    AuthContext.tsx     - Auth + gamification state (points, challenges, bookmarks)
  lib/
    apiClient.ts        - HTTP client + mock layer
```

### Tab Structure (Role-Based)
- **Attendee tabs**: Feed · Audience · Engage · Agenda · Partners
- **Sponsor tabs**: Feed · Audience · Scan Badge · Agenda · Leads

### Screen Features

**Feed**: Video session cards (live indicator, like/share), live poll voting with animated results, filter by sessions/polls, points display, profile avatar button

**Audience**: Full attendee list with search, connection requests, connection counter

**Engage (Attendee)**: Points + tier progress card, challenges with progress bars and claim, leaderboard top-5 with medals, giveaway draw entry

**Engage (Sponsor)**: Stats dashboard (leads/visits/engagement), QR scanner with simulated scan, leads list with hot/warm/cold status, lucky draw with random winner picker, analytics placeholder

**Agenda**: Day-tab session schedule with track color coding, bookmarking

**Partners**: Tier-filtered sponsor cards with giveaway info, bookmark, book meeting, website

**Profile**: Avatar with tier ring, stats (points/challenges/bookmarks), preferences toggles (notifications, reminders), event info (venue/WiFi), logout

### Authentication
- Phone number → OTP flow (6-digit)
- Mock phone numbers: `5550000001` (Jessica/attendee, Silver), `5550000002` (Michael/attendee, Gold), `8156699646` (Alex/attendee, Bronze), `5550009999` (Sarah/sponsor)
- Demo OTP: `123456`
- New phone = registration form (name, email, title, company)

### Environment Variables
| Variable | Purpose | Default |
|---|---|---|
| `EXPO_PUBLIC_USE_MOCK_API` | Use mock data (`true`) or real API | `true` |
| `EXPO_PUBLIC_API_BASE_URL` | Laravel backend URL | `https://api.cxoinc.com/v1` |

### Workflows
- **Start Mobile**: `cd mobile && npx expo start --web --port 8080` (console mode)
  - Web preview: switch to port 8080 in Replit preview pane
  - Device testing: scan QR code with Expo Go app
- **Start application**: `npm run dev` (web app, port 5000)

---

## Web App (Legacy Reference)

**Location**: Root `/`
- React 18 + Vite + TypeScript + Tailwind CSS
- Mock event codes: `TECH26`, `DEVCON`, `SUMMIT`, `HEALTH`, `DESIGN`
- Port: 5000

### Web App API Layer (Task 1 — API Foundation & Phone OTP Auth)

New files added under `src/app/api/`:
- **`client.ts`** — Shared fetch wrapper: base URL injection, Bearer token from localStorage, 401 auto-logout, network retry (2x), typed `ApiEnvelope<T>` response
- **`authClient.ts`** (rewritten) — Phone OTP auth flow:
  - `sendOtp(phone)` → `POST /api/auth/send-otp`
  - `verifyOtp(phone, otp)` → `POST /api/auth/verify-otp` → returns `{ token, user, isNewUser }`
  - `registerUser(params)` → `POST /api/auth/register` → creates new user + saves token
  - `getMeApi()` → `GET /api/auth/me` → restores session from localStorage token

**WelcomeScreen.tsx** — Replaced inline mock DB with real auth client calls. Handles: phone send-otp, OTP verification, existing user profile review, new user registration. Shows proper error messages for wrong OTP, network errors.

**AppContext.tsx** — On mount, calls `getMeApi()` to restore session from saved token. Exposes `sessionRestored` boolean so the app can wait before rendering.

**App.tsx** — Watches `sessionRestored + user` to auto-skip welcome screen when session is restored.

### CORS / API Proxy (Web App — Dev)
In development the Vite dev server proxies all `/api` requests to the backend (`vite.config.ts → server.proxy`). This eliminates browser CORS errors without touching the backend. `client.ts` sets `API_BASE_URL = ''` in dev mode so calls use relative paths through the proxy. In production the full backend URL is used directly (`import.meta.env.DEV` check).

### CORS / API Proxy (Mobile App — Dev Web)
When running the Expo app as a web preview (port 8080), API calls go through the Metro dev server proxy defined in `mobile/metro.config.js`. The proxy uses native Node.js `https` module to forward `/api/*` requests to the backend. OPTIONS preflight requests are answered directly by the proxy (returning 204 with full CORS headers).

**Key fix**: Expo's internal `CorsMiddleware` (`@expo/cli`) blocked all requests from `*.replit.dev` origins by default. The patch script at `mobile/scripts/patch-cors.js` (run automatically via `postinstall`) adds `*.replit.dev` and `*.replit.app` to the allowed origins list. This patch is idempotent (safe to re-run).

### Environment Variables (Web App)
| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Overrides backend URL (optional; dev uses proxy with empty base URL) |
| `VITE_TENANT_ID` | Tenant ID header (`1` by default) |

### Web App API Clients (src/app/api/)
- `authClient.ts` — Email OTP login/register, getMeApi (includes badgeCode from badge_code field)
- `audienceClient.ts` — Event members list/detail via v2 flat API (`/api/v1/events/:id/members`)
- `leadsClient.ts` — Universal badge scan leads: scanBadgeLead, listLeads, updateLeadApi, triggerLuckyDraw (all event-scoped: `/api/v1/events/:eventId/leads/*`)
- `eventsClient.ts` — List events, get event, join by code
- `feedClient.ts` — Paginated feed (video+poll), mark video watched
- `agendaClient.ts` — List sessions with day/track filters, bookmark
- `sponsorsClient.ts` — List sponsors by tier, get sponsor detail

### Universal Badge System (Web App)
- **BottomNav**: Single universal 5-tab nav for ALL roles — Feed | Audience | My Badge | Scan | Leads (role split removed)
- **MyBadgePage** (`src/app/components/MyBadgePage.tsx`): Full-screen QR badge with user's id+badge_code+event as JSON payload, badge code pill, download/share
- **SponsorScannerPage**: Universal scanner (all roles); passes eventId to backend
- **LeadsPage**: Universal leads view (all roles); event-scoped API calls
- **badgeCode** propagated from `/api/v1/me` → AuthUser → AppContext User

### Backend Endpoints Needed
See `BACKEND_SCAN_ENDPOINTS.md` for the full spec. Required:
- `GET /api/v1/events/:eventId/members?badge_code=:code` — resolve badge to profile
- `POST /api/v1/events/:eventId/leads/scan` — save a scanned lead
- `GET /api/v1/events/:eventId/leads` — list user's leads
- `PUT /api/v1/events/:eventId/leads/:id` — update a lead
- `POST /api/v1/events/:eventId/leads/draw` — lucky draw winner

### Web App DataState Component
`src/app/components/ui/DataState.tsx` — Reusable loading skeleton + error retry UI applied to: Feed, Events, Agenda, Sponsors pages.

---

## Backend

- **Laravel PHP 8.4** at `https://bef44c34-7df5-4c09-93a2-5684b5888527-00-3s6pvdiz19h8o.spock.replit.dev/`
- Note: CORS must be configured on backend before enabling live API (set `EXPO_PUBLIC_USE_MOCK_API=false`)

---

## Deployment Target

- **iOS App Store** + **Google Play Store** via EAS Build (Expo Application Services)
- Bundle ID: `com.cxoinc.events`
- App name: CXO Events

---

## npm Install Notes

Always use `--legacy-peer-deps` flag when installing packages in `/mobile`:
```bash
cd mobile && npm install <package> --legacy-peer-deps
```
