---
name: Path B check-in toast race
description: checkInMemberApi fired with void in Path B's .then() resolves almost instantly via mock, overwriting the attendee-points toast before Playwright (or slow devices) can see it.
---

## Rule
When `attendeePointsAwarded > 0` in Path B's `scanBadgeLead` callback, skip the auto-check-in toast entirely. The points toast is the meaningful feedback; the check-in is a side-effect that doesn't need its own notification in that context.

**Why:** `checkInMemberApi` is called with `void` (fire-and-forget) so its `.then(ok => showToast('Auto checked-in …'))` runs as a separate microtask. In Playwright (and fast real devices) this resolves in <5 ms, replacing the attendee-points toast before any observer can detect it. The window is so narrow it produces a classic intermittent flake — passes sometimes, fails sometimes depending on scheduler timing.

**How to apply:** In `SponsorScannerPage.tsx` Path B `.then()` callback, compute `attendeePoints` first, then gate the entire `if (!bCheckedIn)` check-in block on `!attendeePoints`. The points toast fires after the gate, guaranteed to be the last thing shown before `onSaved?.()`.
