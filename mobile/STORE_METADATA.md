# CXO Events — App Store & Google Play Metadata

> **Instructions for marketing team**: Replace all placeholder text (marked with `[PLACEHOLDER]`) with final copy.
> All character limits are noted. Screenshots must be provided in the required sizes listed at the bottom.

---

## App Identity

| Field | Value |
|---|---|
| **App Name** | CXO Events |
| **Bundle ID (iOS)** | com.apexevents.meet |
| **Package Name (Android)** | com.apexevents.meet |
| **Version** | 1.0.0 |
| **Age Rating** | 4+ (no objectionable content) |
| **Primary Category** | Business |
| **Secondary Category** | Productivity |
| **Primary Language** | English (US) |

---

## Apple App Store

### App Name (30 chars max)
```
CXO Events
```

### Subtitle (30 chars max)
```
Your Executive Event Companion
```

### Promotional Text (170 chars max — shown at top, can be updated anytime without new build)
```
The all-in-one companion for CXO Inc executive events. Network, engage, and stay on top of every session — right from your phone.
```

### Description (4000 chars max)
```
CXO Events is the official companion app for CXO Inc conferences and executive summits. Whether you're an attendee or a sponsor, everything you need to get the most from your event is here.

STAY ON SCHEDULE
• Full agenda with track filters and day-by-day views
• Bookmark your must-attend sessions and get reminders
• Speaker bios, room locations, and session details at a glance

CONNECT WITH PEERS
• Browse the full attendee directory — filter by tier and interest
• Send meeting requests and confirm time slots in-app
• View sponsor profiles and connect with exhibitors

ENGAGE & EARN
• Vote in live session polls and earn gamification points
• Complete challenges to climb the event leaderboard
• Enter sponsor giveaways for a chance to win prizes
• Fill out session surveys to shape future events

SPONSOR TOOLS
• Scan attendee QR badge codes to capture leads instantly
• Manage your lead pipeline with hot/warm/cold status tags
• Run a live lucky draw from your collected leads
• Track engagement in real time

CONTENT FEED
• Watch session highlight clips and on-demand video content
• Vote in feed polls and discover trending content
• Infinite scroll with autoplay for seamless browsing

Powered by CXO Inc's enterprise event platform.
```

### Keywords (100 chars max, comma-separated)
```
conference,events,networking,business,summit,CXO,executive,agenda,leads,sponsor,gamification,polls
```

### Support URL
```
https://apexevents.com/support
```

### Marketing URL
```
https://apexevents.com/events-app
```

### Privacy Policy URL
```
https://apexevents.com/privacy
```

---

## Google Play Store

### App Title (50 chars max)
```
CXO Events — Executive Conference App
```

### Short Description (80 chars max)
```
Your all-in-one companion for CXO Inc executive events & conferences.
```

### Full Description (4000 chars max)
```
CXO Events is the official companion app for CXO Inc conferences and executive summits.

ATTENDEE FEATURES
✓ Full agenda with track and day filters
✓ Session bookmarks and speaker profiles
✓ Live attendee directory with search and tier filters
✓ In-app meeting requests and scheduling
✓ Partner and sponsor directory

GAMIFICATION & ENGAGEMENT
✓ Earn points by voting in polls and completing challenges
✓ Leaderboard — see where you rank among peers
✓ Enter sponsor giveaways to win prizes
✓ Complete session surveys for bonus points

CONTENT FEED
✓ On-demand session highlights and videos
✓ Live feed polls with instant results
✓ Infinite scroll with autoplay

SPONSOR TOOLS
✓ QR badge scanner to capture leads instantly
✓ Lead management with status tagging (hot/warm/cold)
✓ Lucky draw — pick a winner from your leads live on stage
✓ Real-time engagement tracking

Built on CXO Inc's enterprise event platform, trusted by thousands of executives worldwide.
```

### Category
```
Business
```

### Tags (Play Store)
```
conference, events, networking, business, executive, summit, agenda, leads
```

---

## Screenshot Requirements

### Apple App Store (all must be provided by marketing team)

| Device | Size | Orientation | Count |
|---|---|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320 × 2868 px | Portrait | 3–10 |
| iPhone 6.5" (iPhone 14 Plus / 11 Pro Max) | 1242 × 2688 px | Portrait | 3–10 |
| iPhone 5.5" (iPhone 8 Plus) — required | 1242 × 2208 px | Portrait | 3–10 |
| iPad Pro 12.9" (6th gen) — required if iPad supported | 2048 × 2732 px | Portrait | 3–10 |

**Recommended screenshots (in order):**
1. Home / Event Dashboard — "Your event, at a glance"
2. Agenda view — "Never miss a session"
3. Feed / Video content — "Watch highlights & vote live"
4. Engage / Gamification — "Earn points, climb the leaderboard"
5. Meetings screen — "Connect with the right people"
6. Sponsor QR scanner — "Capture leads instantly" (sponsor view)

### Google Play (all must be provided by marketing team)

| Asset | Size |
|---|---|
| Phone screenshots | 1080 × 1920 px (16:9 or 9:16) — min 2, max 8 |
| 7" tablet screenshots (optional) | 1200 × 1920 px |
| 10" tablet screenshots (optional) | 1600 × 2560 px |
| Feature graphic (required) | 1024 × 500 px |
| App icon | 512 × 512 px (Google generates from adaptive icon) |

---

## Build Commands

```bash
# Install EAS CLI
npm install -g eas-cli

# Authenticate with Expo account
eas login

# Configure project (first time only)
eas build:configure

# Development build (install on device with Expo Go)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build (internal testing / TestFlight)
eas build --profile preview --platform all

# Production build (App Store / Play Store)
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit to stores (after production build)
eas submit --platform ios
eas submit --platform android
```

### Required environment variables (set in EAS dashboard or .env.local)
```
EXPO_PUBLIC_API_BASE_URL=https://your-backend.example.com
EXPO_PUBLIC_USE_MOCK_API=false
```

---

## Deep Link Routes

| URL | Opens |
|---|---|
| `apexevents://join?code=CXOSUMMIT26` | Switch Event screen with code pre-filled |
| `https://apexevents.com/join?code=CXOSUMMIT26` | Same (universal link / app link) |

Configure universal links (iOS) and app links (Android) by:
1. Hosting `/.well-known/apple-app-site-association` on `apexevents.com`
2. Hosting `/.well-known/assetlinks.json` on `apexevents.com`
3. Confirming `app.json` → `extra.eas.projectId` is set (currently `83d2b604-c6aa-45fe-a707-16f09d2c578c`) and running `eas login` before builds
