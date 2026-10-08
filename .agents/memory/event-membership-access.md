---
name: Existing event membership and role access
description: Product requirement and authorization limits for admitting existing audience members and sponsor reps.
---
Existing event audience members and sponsor reps must enter without being forced to rejoin or provide a key. Preserve the event-specific sponsor role; audience membership must not acquire sponsor capabilities.

The user explicitly reiterated the join rule: a correct key must allow entry and add the attendee to the event audience; an existing audience member must bypass the join screen. Navigation alone is not successful registration.

**Why:** The user reported that people already assigned to the event audience were being blocked by an invalid-key prompt, and explicitly required access for both audience and sponsor-rep roles. The backend access check can disagree with membership directory data; a local event-list match is not authorization.

**How to apply:** Resolve membership from authenticated backend access or an exact account match in the event's member/attendee roster, including pagination. A directory fallback matters because the all-role member endpoint may be restricted while the attendee directory is available. Explicit revoked/inactive memberships must not be overridden. Treat unavailable verification separately from an invalid key; never grant entry solely from stored join history, a public event code/title, or an "already" error message.

Join responses can represent a membership rather than an event. A generic resource `id` must not be interpreted as an event reference.

**Why:** The user reported a correct key producing a “different event” error after a successful join; the client had an ambiguous generic-ID fallback. Membership and event identities have separate meanings.

**How to apply:** Resolve the joined event only from explicit event fields or an event object, retaining outer envelope fields when nested data contains a membership resource. If the backend does not identify the event, require a successful join with the selected event's exact key or verify its membership before entering.
