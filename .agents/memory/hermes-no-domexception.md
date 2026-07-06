---
name: Hermes lacks DOMException global
description: Why native builds showed generic errors for every network failure while web worked; engine-agnostic error classification rules.
---

**Rule:** Never reference `DOMException` (or other browser-only globals) in code shared with React Native/Hermes. Hermes does not define `DOMException`, so `err instanceof DOMException` throws a ReferenceError at evaluation time.

**Why:** In production Android builds, that ReferenceError was thrown *inside* the API client's catch-block classifier, escaping request() entirely and surfacing the UI's generic "Something went wrong" for EVERY network-level failure (timeouts, DNS, TLS). Web was unaffected because browsers define DOMException — which made the bug look like a backend/connectivity problem. Backend probes (curl, okhttp-style headers, HTTP/2, rapid-fire) all returned 200, ruling out the server.

**How to apply:**
- Classify aborts by `err?.name === 'AbortError' || msg.includes('abort')` — engine- and realm-agnostic.
- Sniff network errors on `err instanceof Error` (not just TypeError) — OkHttp/NSURLSession sometimes surface plain Errors.
- When a symptom is "web fine, native always generic error," suspect browser-only globals (DOMException, DOMParser, navigator.*, window.*) in shared error paths before suspecting the network/TLS.
- TLS chain of app.cxocollaborate.com verified complete (Let's Encrypt, cross-signed to ISRG Root X1) — not a native trust issue.
