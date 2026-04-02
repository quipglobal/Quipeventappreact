# CXO Inc — Backend API Reference

This document defines every HTTP endpoint the mobile app calls.
Implement these as Laravel routes in `routes/api.php`.
All endpoints are prefixed `/api` and expect `Accept: application/json`.

---

## Authentication

All protected routes require:
```
Authorization: Bearer <token>
```
The token is a Laravel Sanctum personal access token.

---

## 1. Auth Endpoints

### 1.1 Send OTP
```
POST /api/auth/send-otp
```
Sends a one-time passcode via SMS to the provided phone number.

**Request body:**
```json
{ "phone": "5550000001" }
```

**Response (200):**
```json
{ "success": true, "data": { "message": "OTP sent" } }
```

**Notes:**
- Use Twilio or similar to send the SMS.
- Store the OTP hash + expiry (5 min) in the database.
- Return 200 even if the phone number is unknown (security).

---

### 1.2 Verify OTP
```
POST /api/auth/verify-otp
```
Validates the OTP. Returns a token and user data (or `isNewUser: true`).

**Request body:**
```json
{ "phone": "5550000001", "otp": "123456" }
```

**Response (200) — existing user:**
```json
{
  "success": true,
  "data": {
    "token": "1|laravel_sanctum_token...",
    "user": {
      "id": 1,
      "phone": "5550000001",
      "name": "Jessica Williams",
      "email": "jessica@stripe.com",
      "title": "Product Designer",
      "company": "Stripe",
      "role": "attendee",
      "points": 120,
      "tier": "Silver",
      "interests": ["Design", "Product"],
      "profile_complete": true
    },
    "is_new_user": false
  }
}
```

**Response (200) — new user (needs registration):**
```json
{
  "success": true,
  "data": {
    "token": "",
    "user": null,
    "is_new_user": true
  }
}
```

**Response (422) — wrong OTP:**
```json
{
  "success": false,
  "error": { "code": "INVALID_OTP", "message": "Incorrect code. Please try again." }
}
```

---

### 1.3 Register (new user)
```
POST /api/auth/register
```
Creates a new user account after OTP verification.

**Request body:**
```json
{
  "phone": "5550000001",
  "name": "Jessica Williams",
  "email": "jessica@stripe.com",
  "title": "Product Designer",
  "company": "Stripe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "token": "1|laravel_sanctum_token...",
    "user": { /* same shape as verify-otp user object */ }
  }
}
```

**Notes:**
- Assign `role: "attendee"` by default.
- Assign `tier: "Bronze"`, `points: 0`.
- Phone uniqueness: if phone already exists, return 409.

---

### 1.4 Get Current User
```
GET /api/auth/me
```
Returns the authenticated user's profile.

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": { /* full user object, same shape as register response */ }
  }
}
```

---

## 2. Feed

### 2.1 Get Feed Page
```
GET /api/feed?cursor=<string>
```
Returns a paginated list of videos and polls interleaved.

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "v1",
        "type": "video",
        "title": "Opening Keynote: The Future of AI",
        "speaker": "Dr. Sarah Chen",
        "company": "TechCorp Solutions",
        "duration": "58:22",
        "views": "1.2K",
        "accentColor": "#7c3aed",
        "live": true,
        "videoUrl": "https://cdn.example.com/video.mp4"
      },
      {
        "id": "poll1",
        "type": "poll",
        "question": "Which topic are you most excited about today?",
        "session": "Opening Keynote",
        "points": 10,
        "options": [
          { "id": "o1", "text": "AI & Machine Learning", "votes": 48 },
          { "id": "o2", "text": "Startup Ecosystem", "votes": 31 }
        ]
      }
    ],
    "nextCursor": "page2",
    "hasMore": true
  }
}
```

**Notes:**
- Use cursor-based pagination (not offset). Store cursor as an opaque string.
- Interleave video + poll items (e.g., 2 videos then 1 poll, repeat).

---

### 2.2 Mark Video Watched
```
POST /api/feed/video/watched
```
Awards points when a user watches a video.

**Auth required:** Yes

**Request body:**
```json
{ "videoId": "v1" }
```

**Response (200):**
```json
{ "success": true, "data": { "points": 20 } }
```

**Notes:**
- Idempotent: don't award points if already watched.
- Update user's `points` field and recalculate `tier`.

---

### 2.3 Submit Poll Vote (Feed)
```
POST /api/polls/vote
```
Records a vote on a poll (either from feed or Engage screen).

**Auth required:** Yes

**Request body:**
```json
{ "pollId": "poll1", "optionId": "o1" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "points": 10,
    "results": [
      { "id": "o1", "votes": 49 },
      { "id": "o2", "votes": 31 }
    ]
  }
}
```

**Notes:**
- Idempotent: one vote per user per poll.
- Award points only on first vote.
- Return updated vote counts.

---

## 3. Attendees

### 3.1 List Attendees
```
GET /api/attendees?tier=Gold&search=jessica
```
Returns paginated attendee list.

**Auth required:** Yes

**Query params (all optional):**
| Param | Type | Description |
|-------|------|-------------|
| `tier` | string | Filter: Bronze / Silver / Gold / Platinum |
| `search` | string | Search name, company, or title |
| `page` | int | Page number |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Jessica Williams",
      "title": "Product Designer",
      "company": "Stripe",
      "role": "attendee",
      "points": 120,
      "tier": "Silver",
      "interests": ["Design", "Product"],
      "bio": "Passionate about crafting user experiences.",
      "avatar": "https://..."
    }
  ]
}
```

---

### 3.2 Get Leaderboard
```
GET /api/leaderboard
```
Returns the top-ranked attendees by points.

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "userId": "1",
      "name": "Aisha Kamara",
      "points": 680,
      "tier": "Platinum",
      "tierColor": "#e5e4e2"
    }
  ]
}
```

**Notes:**
- `tierColor` must match: Bronze `#cd7f32`, Silver `#c0c0c0`, Gold `#ffd700`, Platinum `#e5e4e2`.
- Return top 20 entries. The app finds the current user's rank by name match.

---

### 3.3 Send Connection Request
```
POST /api/connections
```
Sends a connection request to another attendee.

**Auth required:** Yes

**Request body:**
```json
{ "attendeeId": "2" }
```

**Response (200):**
```json
{ "success": true, "data": { "connected": true } }
```

---

## 4. Events

### 4.1 List My Events
```
GET /api/events
```
Returns all events the authenticated user has access to.

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "evt1",
      "name": "CXO Tech Summit 2026",
      "code": "CXOSUMMIT",
      "startDate": "2026-01-16",
      "endDate": "2026-01-18",
      "location": "San Francisco, CA",
      "description": "The premier CXO event of the year.",
      "status": "live"
    }
  ]
}
```

---

### 4.2 Get Event by ID
```
GET /api/events/:id
```

**Auth required:** Yes

**Response (200):**
```json
{ "success": true, "data": { /* same event object */ } }
```

---

### 4.3 Join Event by Code
```
POST /api/events/join
```
Joins an event using an invite code. Grants access to all event content.

**Auth required:** Yes

**Request body:**
```json
{ "code": "CXOSUMMIT" }
```

**Response (200):**
```json
{ "success": true, "data": { /* event object */ } }
```

**Response (404):**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Event not found for that code." } }
```

---

## 5. Sessions / Agenda

### 5.1 List Sessions
```
GET /api/sessions?day=1&track=Main+Stage
```

**Auth required:** Yes

**Query params (all optional):**
| Param | Type | Description |
|-------|------|-------------|
| `day` | int | Day number: 1, 2, 3 |
| `track` | string | e.g. "Main Stage", "Engineering", "AI/ML" |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "s1",
      "title": "Opening Keynote: The Future of AI",
      "speaker": "Dr. Sarah Chen",
      "speakerTitle": "Chief AI Officer",
      "speakerCompany": "TechCorp Solutions",
      "track": "Main Stage",
      "room": "Main Hall",
      "day": 1,
      "startTime": "9:00 AM",
      "endTime": "10:00 AM",
      "description": "An exploration of how AI is reshaping industries.",
      "tags": ["AI", "Keynote"],
      "accentColor": "#7c3aed"
    }
  ]
}
```

**Notes:**
- `day` is 1-indexed (day 1 = Jan 16, day 2 = Jan 17, day 3 = Jan 18).
- `accentColor` is a hex color string for UI theming.

---

### 5.2 Get Session by ID
```
GET /api/sessions/:id
```

**Auth required:** Yes

**Response (200):**
```json
{ "success": true, "data": { /* session object */ } }
```

---

### 5.3 Bookmark Session
```
POST /api/sessions/bookmark
```

**Auth required:** Yes

**Request body:**
```json
{ "sessionId": "s1", "bookmarked": true }
```

**Response (200):**
```json
{ "success": true, "data": { "bookmarked": true } }
```

---

## 6. Gamification (Engage Screen)

### 6.1 List Challenges
```
GET /api/challenges
```

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "c1",
      "title": "Visit 3 Booths",
      "desc": "Scan badges at 3 sponsor booths",
      "emoji": "🏆",
      "points": 75,
      "progress": 2,
      "total": 3
    }
  ]
}
```

**Notes:**
- `progress` and `total` are per-user values. Track per-user progress in DB.
- The app shows a "Claim" button when `progress === total`.

---

### 6.2 Complete Challenge
```
POST /api/challenges/complete
```

**Auth required:** Yes

**Request body:**
```json
{ "challengeId": "c1" }
```

**Response (200):**
```json
{ "success": true, "data": { "points": 75 } }
```

---

### 6.3 List Polls (Engage Tab)
```
GET /api/polls
```
Standalone polls for the Engage screen (different from feed polls).

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "p1",
      "question": "Which AI use case excites you most in 2026?",
      "session": "Keynote",
      "points": 10,
      "totalVotes": 219,
      "options": [
        { "id": "o1", "text": "Generative AI", "votes": 87 },
        { "id": "o2", "text": "AI Agents", "votes": 61 }
      ]
    }
  ]
}
```

**Notes:**
- Can reuse the `/api/polls/vote` endpoint (section 2.3) for voting here too.

---

### 6.4 List Surveys
```
GET /api/surveys
```

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "sv1",
      "title": "Morning Workshop Feedback",
      "desc": "Rate the sessions you attended this morning.",
      "questions": 5,
      "points": 50
    }
  ]
}
```

---

### 6.5 Submit Survey
```
POST /api/surveys/submit
```

**Auth required:** Yes

**Request body:**
```json
{
  "surveyId": "sv1",
  "answers": {
    "q1": "Very satisfied",
    "q2": "Dr. Sarah Chen",
    "q3": "5"
  }
}
```

**Response (200):**
```json
{ "success": true, "data": { "points": 50 } }
```

---

### 6.6 List Giveaways
```
GET /api/giveaways
```

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "g1",
      "title": "MacBook Pro 16\"",
      "sponsor": "TechCorp Solutions",
      "entries": 142,
      "ends": "3:00 PM",
      "color": "#7c3aed",
      "entered": false
    }
  ]
}
```

**Notes:**
- `entered` should be `true` if the current user has already entered this giveaway.

---

### 6.7 Enter Giveaway
```
POST /api/giveaways/enter
```

**Auth required:** Yes

**Request body:**
```json
{ "giveawayId": "g1" }
```

**Response (200):**
```json
{ "success": true, "data": { "entered": true, "entries": 143 } }
```

---

## 7. Sponsors / Partners

### 7.1 List Sponsors
```
GET /api/sponsors?tier=Gold
```

**Auth required:** Yes

**Query params (optional):**
| Param | Type | Description |
|-------|------|-------------|
| `tier` | string | Platinum / Gold / Silver / Bronze |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "s1",
      "name": "TechCorp Solutions",
      "tier": "Platinum",
      "tagline": "Building the future of enterprise AI",
      "category": "AI & Cloud",
      "boothNumber": "A1",
      "tierColor": "#e5e4e2",
      "accentColor": "#7c3aed",
      "giveaway": "MacBook Pro 16\"",
      "website": "techcorp.example.com",
      "description": "TechCorp is a global leader in AI-powered enterprise solutions.",
      "logoUrl": "https://cdn.example.com/logos/techcorp.png"
    }
  ]
}
```

---

### 7.2 Get Sponsor by ID
```
GET /api/sponsors/:id
```

**Auth required:** Yes

**Response (200):**
```json
{ "success": true, "data": { /* sponsor object */ } }
```

---

## 8. Meetings

### 8.1 List Meetings
```
GET /api/meetings
```

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "m1",
      "type": "incoming",
      "attendee": {
        "id": "2",
        "name": "Jessica Williams",
        "title": "Product Designer",
        "company": "Stripe",
        "role": "attendee",
        "points": 120,
        "tier": "Silver",
        "interests": []
      },
      "status": "pending",
      "proposedTime": "2:00 PM - 2:30 PM",
      "message": "I would love to discuss design partnerships.",
      "createdAt": "2026-01-16T09:15:00Z"
    }
  ]
}
```

**Notes:**
- `type: "incoming"` means the other person sent the request to the current user.
- `type: "outgoing"` means the current user sent the request.

---

### 8.2 Send Meeting Request
```
POST /api/meetings
```

**Auth required:** Yes

**Request body:**
```json
{
  "attendeeId": "3",
  "proposedTime": "2:00 PM - 2:30 PM",
  "message": "Would love to connect about your work at DesignFlow."
}
```

**Response (201):**
```json
{ "success": true, "data": { /* meeting object with type: "outgoing", status: "pending" */ } }
```

---

### 8.3 Respond to Meeting
```
PATCH /api/meetings/:id/respond
```

**Auth required:** Yes

**Request body:**
```json
{ "action": "accept" }
```
or
```json
{ "action": "decline" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    /* meeting object with status: "accepted" or "declined" */
  }
}
```

---

## 9. Sponsor Tools (role: sponsor only)

### 9.1 List Leads
```
GET /api/sponsor/leads
```

**Auth required:** Yes (sponsor role)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "l1",
      "name": "Alex Thompson",
      "title": "CTO",
      "company": "StartupXYZ",
      "email": "alex@startupxyz.com",
      "phone": "5551234567",
      "scannedAt": "9:32 AM",
      "color": "#7c3aed",
      "status": "warm",
      "notes": "Interested in enterprise plan"
    }
  ]
}
```

**Notes:**
- `color` is an arbitrary hex for avatar theming — backend can generate it deterministically from attendee ID.

---

### 9.2 Scan Badge (Capture Lead)
```
POST /api/sponsor/scan
```

**Auth required:** Yes (sponsor role)

**Request body (QR code decoded JSON):**
```json
{
  "badgeData": "{\"id\":\"user-123\",\"name\":\"Alex Thompson\",\"event\":\"cxo-summit-2026\",\"role\":\"attendee\"}",
  "attendeeId": "123",
  "name": "Alex Thompson",
  "company": "StartupXYZ",
  "title": "CTO",
  "eventId": "evt1"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "l1",
    "name": "Alex Thompson",
    "title": "CTO",
    "company": "StartupXYZ",
    "scannedAt": "9:32 AM",
    "color": "#7c3aed",
    "status": "warm"
  }
}
```

**Notes:**
- Idempotent: if this attendee was already scanned by this sponsor, return existing lead.
- Set default `status: "warm"`.

---

### 9.3 Update Lead Status
```
PATCH /api/sponsor/leads/:id
```

**Auth required:** Yes (sponsor role)

**Request body:**
```json
{ "status": "hot" }
```
Possible values: `hot`, `warm`, `cold`

**Response (200):**
```json
{ "success": true, "data": { /* updated lead object */ } }
```

---

### 9.4 Lucky Draw
```
POST /api/sponsor/lucky-draw
```
Randomly selects a winner from the sponsor's captured leads.

**Auth required:** Yes (sponsor role)

**Request body (optional):**
```json
{ "giveawayId": "g1" }
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "winner": {
      "id": "l2",
      "name": "Rachel Kim",
      "title": "VP Product",
      "company": "ScaleUp Co",
      "scannedAt": "10:15 AM",
      "color": "#06b6d4",
      "status": "warm"
    }
  }
}
```

---

## 10. Profile / Points

### 10.1 Get User Points
```
GET /api/profile/points
```

**Auth required:** Yes

**Response (200):**
```json
{
  "success": true,
  "data": {
    "points": 120,
    "tier": "Silver"
  }
}
```

**Notes:**
- Tier thresholds: Bronze 0–99, Silver 100–249, Gold 250–499, Platinum 500+.

---

### 10.2 Update Profile
```
PATCH /api/profile
```

**Auth required:** Yes

**Request body (all fields optional):**
```json
{
  "name": "Jessica Williams",
  "email": "jessica@stripe.com",
  "title": "Senior Product Designer",
  "company": "Stripe",
  "interests": ["Design", "Product", "AI"]
}
```

**Response (200):**
```json
{ "success": true, "data": { /* updated user object */ } }
```

---

## General Response Conventions

All responses follow this envelope format:

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message." } }
```

**Common error codes:**
| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Token missing or expired |
| `FORBIDDEN` | 403 | Role-based access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_OTP` | 422 | Wrong OTP code |
| `VALIDATION_ERROR` | 422 | Field validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Unexpected server error |

---

## Points & Tier Logic

| Action | Points Awarded |
|--------|---------------|
| Watch a video | 20 pts |
| Vote in a poll | 10 pts |
| Submit a survey | 50–75 pts |
| Complete a challenge | 30–150 pts |
| Enter a giveaway | 10 pts |
| Send connection request | 15 pts |
| Accept meeting request | 20 pts |

| Tier | Points Range |
|------|-------------|
| Bronze | 0 – 99 |
| Silver | 100 – 249 |
| Gold | 250 – 499 |
| Platinum | 500+ |

---

## Laravel Implementation Notes

### Suggested Migration Tables

- `users` — id, phone, name, email, title, company, role (enum: attendee/sponsor), points, tier, profile_complete, timestamps
- `otps` — id, phone, code_hash, expires_at, used_at, timestamps
- `events` — id, name, code, start_date, end_date, location, status, timestamps
- `event_users` — event_id, user_id (pivot)
- `sessions` — id, event_id, title, speaker, speaker_title, speaker_company, track, room, day, start_time, end_time, description, accent_color, tags (JSON), timestamps
- `session_bookmarks` — user_id, session_id
- `feed_videos` — id, session_id, title, speaker, company, duration, views, accent_color, video_url, is_live, timestamps
- `polls` — id, event_id, question, session, points, timestamps
- `poll_options` — id, poll_id, text, votes
- `poll_votes` — user_id, poll_id, option_id
- `challenges` — id, event_id, title, desc, emoji, points, total
- `challenge_progress` — user_id, challenge_id, progress, completed_at
- `surveys` — id, event_id, title, desc, questions, points
- `survey_responses` — user_id, survey_id, answers (JSON), completed_at
- `giveaways` — id, sponsor_id, event_id, title, ends_at, color
- `giveaway_entries` — user_id, giveaway_id
- `sponsors` — id, name, tier, tagline, category, booth_number, tier_color, accent_color, giveaway, website, description, logo_url
- `leads` — id, sponsor_id, attendee_id, status (enum), notes, scanned_at
- `connections` — id, user_id, target_user_id, status, timestamps
- `meetings` — id, requester_id, requestee_id, status (enum), proposed_time, message, timestamps

### Middleware
- `auth:sanctum` — required on all protected routes
- `role:sponsor` — custom middleware for sponsor-only endpoints

### Laravel Sanctum
Use `php artisan sanctum:install` and Sanctum tokens for the Bearer auth.
Return tokens with `$user->createToken('mobile')->plainTextToken`.
