---
name: Screenshot tool does fresh navigation per call
description: Why short-lived UI states (splash screens, transient animations) always appear "stuck" in app_preview screenshots
---

The `screenshot` tool's `app_preview` type reloads/re-navigates the page fresh on every call — it does not reuse a persistent browser session. Console logs always restart from "Running application main" on each call, confirming this.

**Why:** This means `sleep`-ing between two `screenshot` calls does NOT let in-page timers/animations advance further — each call only captures whatever state the page reaches in the few seconds between fresh navigation and the internal capture. Any UI with a timed transition shorter than a few seconds (splash screens, toasts, loading states with a fallback timer) will consistently look "frozen" in screenshots even when it resolves correctly in a real, continuously-running session.

**How to apply:** Don't conclude a splash/loading screen is "stuck forever" from repeated `screenshot` calls alone. To verify timed transitions actually resolve, either (a) temporarily shorten the relevant timeout in code as a diagnostic and confirm the next screen renders, then revert, or (b) use `runTest` (Playwright-based, holds a real persistent session and can wait/poll for elements) — this is the reliable way to confirm a timed UI transition completes.
