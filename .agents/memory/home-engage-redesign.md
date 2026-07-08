---
name: Home & Engage tab redesign patterns
description: Architecture and patterns used in the mobile Home (feed.tsx) and Engage (engage.tsx) tab redesigns.
---

## Home Tab (feed.tsx)

Uses `useEvents()` + `currentEventId` to find the current event object for the banner. Event type has `startDate`, `endDate`, `location`, `bannerUrl` fields.

Fallback image uses `require('../../assets/splash.png')` (not `@/assets/images/splash.png` which doesn't exist — assets are in `mobile/assets/`).

**Why:** The asset path for splash in mobile tabs is `../../assets/splash.png` relative to `app/(tabs)/`.

## Engage Tab (engage.tsx)

Hub redesign uses a `section: EngageSection` state enum instead of tab index. Each section renders its own full-screen view with a back button. This avoids nested navigation and keeps the state management simple.

SponsorReviews requires both `companyId` and `companyName` props.

**Why:** The SponsorReviews component was designed to show the company name in the UI header.

## useSpeakers hook

`listSpeakers()` in `mobile/lib/api/users.ts` pages `/api/v1/events/:id/members` (not `/attendees`). Filters by `roles` array containing "speaker" OR `member_type === 'speaker'` OR `role === 'speaker'`.

**Why:** Members API (not attendees) is where speaker roles are assigned per-event.

## Android Footer

`useSafeAreaInsets().bottom` gives the exact Android navigation bar height. Tab bar height = 56 + bottomInset, paddingBottom = bottomInset + 4.

**Why:** The old hardcoded 64px height missed gesture navigation bar inset, causing content overlap.
