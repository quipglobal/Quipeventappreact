# CXO Inc. Event Companion App

A full-stack event companion platform for attendees and sponsors.

## Run & Operate

**Mobile App:**
- Start: `cd mobile && REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN npx expo start --go --port 5000`
  - Runs on port 5000 (`outputType: webview`) — shows live app in Replit preview pane
  - QR code in Metro console: `exp://REPLIT_DEV_DOMAIN:5000` — scan with Expo Go on a physical device
  - Web preview auto-proxies `/api/*` to `https://app.cxocollaborate.com` via metro.config.js
  - Replit built-in simulator does NOT support Expo SDK 52 (platform limitation)
- Build Production: `eas build --profile production --platform all`
- Environment Variables:
    - `EXPO_PUBLIC_USE_MOCK_API`: `false` (always use real API)
    - `EXPO_PUBLIC_API_BASE_URL`: `https://app.cxocollaborate.com`

**Web App (Legacy):**
- Start: `npm run dev` (runs on port 5000 — stop "Start Mobile" first to free the port)
- Build: `npm run build`
- Test (e2e): `npm run test:e2e`
- Environment Variables:
    - `VITE_API_BASE_URL`: (optional; dev uses proxy)
    - `VITE_TENANT_ID`: `3` (CXO tenant — events 21, 28, 53, 832, etc.)

**Backend:**
- URL: `https://app.cxocollaborate.com/api/v1`

## Stack

**Mobile App:**
- Framework: React Native 0.76.3 (Expo SDK 52) + TypeScript
- Router: Expo Router v4
- State Management: React Context (AuthContext)
- UI: Custom dark theme, LinearGradient, Ionicons
- Data Fetching: Custom fetch client
- Storage: AsyncStorage

**Web App (Legacy):**
- Framework: React 18 + Vite + TypeScript
- Styling: Tailwind CSS

**Backend:**
- Laravel PHP 8.4

## Where things live

- **Mobile App Source**: `/mobile/`
    - Root layout: `/mobile/app/_layout.tsx`
    - Auth gate: `/mobile/app/index.tsx`
    - Theme definitions: `/mobile/constants/theme.ts`
    - Auth & Gamification Context: `/mobile/context/AuthContext.tsx`
    - API Client: `/mobile/lib/apiClient.ts`
- **Web App Source (Legacy)**: `/src/`
    - API Clients: `/src/app/api/`
        - `meetingsClient.ts` — connection requests (GET/POST/PATCH v1 meeting-requests routes)
        - `messagesClient.ts` — encrypted conversations + messages (GET/POST/PUT/DELETE)
    - Crypto: `src/app/lib/messageCrypto.ts` — AES-GCM per-conversation key derivation (HKDF-SHA256)
    - Lead Edits Storage: `src/app/lib/leadEditsStorage.ts`
    - Giveaway Winners Storage: `src/app/lib/giveawayWinnersStorage.ts`
- **Backend API Contract**: `BACKEND_SCAN_ENDPOINTS.md`

## Architecture decisions

- **Mobile-first Development**: The mobile app (`/mobile/`) is the primary product, while the root web app is a legacy reference implementation.
- **Role-aware Mobile Navigation**: Mobile app uses role-based tab structures (Attendee vs. Sponsor) for tailored UX.
- **Client-Side Lead Detail Persistence**: Web app uses optimistic UI, localStorage overlay, and defensive merging to protect user edits on leads, even if backend persistence is not yet fully implemented.
- **Client-Side Lucky Draw Fallback**: If the backend lucky draw endpoint is unavailable or errors, the web app performs a client-side random pick to ensure UX completion.
- **Cross-Actor Giveaway Sync**: Giveaway winners are synced across devices and actors by merging backend-arbitrated winners with local overlays, prioritizing backend data.
- **Client-Side Message Encryption**: Chat messages are AES-GCM 256 encrypted before leaving the device (`messageCrypto.ts`). Key is HKDF-derived from `connectionId + sorted user ids`. Server only stores `{ ciphertext, iv, scheme }`. 5-second Undo window defers the encrypted POST so the user can retract before it hits the network. Hardening path: swap deterministic derivation for ECDH key exchange once backend stores per-user public keys.
- **NOT_IMPLEMENTED Short-Circuit Pattern**: All event-scoped API clients (meetings, messages, giveaways, leaderboard) flip a session-scoped flag on the first 404/405 and short-circuit subsequent calls. State is managed optimistically in `AppContext` with rollback on hard failures. Flag resets on event switch so a newly-deployed backend route is picked up immediately.

## Product

- **Mobile App**:
    - Phone number OTP login/registration.
    - Interactive feed with video sessions, live polls, and gamification points.
    - Searchable attendee directory with connection requests.
    - Gamification features (points, challenges, leaderboard) for attendees.
    - Sponsor tools (QR scanner for lead capture, lucky draw, analytics dashboard).
    - Session agenda with bookmarking.
    - Sponsor showcase with meeting booking.
- **Web App (Legacy)**:
    - Phone number OTP login/registration.
    - Universal badge system with QR code display and scanning.
    - Lead management (scan, list, update notes/tags/priority).
    - Sponsor giveaway creation, editing, and deletion.
    - Lucky draw functionality for sponsors.
    - Connect + Message: send/accept/decline connection requests; accept-gated encrypted chat with edit, delete, and 5-second undo.

## User preferences

_Populate as you build_

## Gotchas

- **CORS for Mobile Web Preview**: Expo's default settings block requests from Replit origins; `mobile/scripts/patch-cors.js` patches `@expo/cli` to allow `*.replit.dev` and `*.replit.app`.
- **`npm install` in Mobile**: Always use `--legacy-peer-deps` when installing packages in `/mobile`.
- **Sponsor Giveaway Ownership**: Edit/delete affordances on giveaways are gated by `AppContext.isMyGiveaway` (permissive for all sponsors); backend remains the source of truth for authorization.
- **Backend Lucky Draw**: The live Laravel backend's lucky draw route (`POST /api/v1/events/:eventId/leads/draw`) may not be deployed or may have routing issues (e.g., `string` vs `int` param mismatch); client-side fallback is in place.
- **Backend Giveaways Empty**: `GET /api/v1/events/:eventId/giveaways` returns `{"success":true,"data":[]}` for ALL events. No giveaway data exists in the backend yet. The backend agent must (a) NOT filter by event/giveaway `end_date`, and (b) expose the full CRUD (see `BACKEND_SCAN_ENDPOINTS.md` §10).
- **Backend Messages/Conversations 404**: `/api/v1/events/:eventId/conversations` returns 404 — these routes are not yet deployed. The client short-circuits to NOT_IMPLEMENTED and keeps conversations in-memory only. `BACKEND_SCAN_ENDPOINTS.md` §9 has the full encrypted-messages contract.
- **Video Feeds Endpoints (live)**: Home Feed tab consumes `GET /api/v1/events/:eventId/event-video-feeds` (paginated — accepts both `?cursor=` and `?page=` styles), `GET /api/v1/events/:eventId/event-video-feeds/:feedId` (detail), and `POST .../:feedId/view` (record watch). Wired in `mobile/lib/api/feed.ts` with infinite-query support via `useVideoFeeds()` in `mobile/hooks/useFeed.ts`.
- **Auto Refresh on Screen Focus**: Every authed query (via `useAuthedQuery` / `useAuthedInfiniteQuery`) invalidates and refetches when its consuming screen gains focus, so navigating to a screen always shows the latest backend state without sign-out / sign-in. Initial mount is skipped to avoid double-firing on top of `useQuery`'s first fetch. Opt-out per call with `refetchOnFocus: false`.
- **Per-Event Query Key Scoping**: Every event-scoped hook (`useFeed`, `useVideoFeeds`, `useVideoFeed`, `usePolls`, `useChallenges`, `useSurveys`, `useGiveaways`, `useAgenda`, `useSession`, `useAudience`, `useLeaderboard`, `usePartners`, `useSponsor`) includes `currentEventId` in its `queryKey` and is gated on `enabled: !!currentEventId`. Without this, React Query happily serves Event A's cache to Event B on switch, and infinite queries accumulate `pages` across events. Any new event-scoped hook MUST follow the same pattern.
- **No Hardcoded Stat KPIs on Dashboard**: `mobile/app/event-dashboard.tsx` previously contained `STATIC_STATS` (Attendees: 842, Sessions Live: 3, Sponsors: 24, Giveaways: 2) and a `SESSIONS_NOW` array with three fake sessions. All KPIs and the "Happening Now" list are now derived from `useAudience` / `useAgenda` / `usePartners` / `useGiveaways` / `usePolls` and computed against real session start/end times. `EVENT_META` is visual-only (banner gradient + category label) — never override backend counts there.

## Pointers

- **Mobile App Directory Structure**: See `/mobile/ARCHITECTURE.md`
- **Backend API Documentation**: `BACKEND_SCAN_ENDPOINTS.md` and `mobile/BACKEND_API.md`