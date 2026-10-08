# Required backend contract: event-scoped key registration

The web and mobile event-card join now send the selected event ID:

```json
{
  "event_id": "3446",
  "event_code": "<submitted-key>",
  "code": "<submitted-key>"
}
```

Endpoint: `POST /api/v1/events/join`, authenticated, tenant-scoped.

## Observed failure

The user selected event 3446, but a successful code-only join returned event
3279. Subsequent authenticated access/roster checks did not confirm membership
in event 3446. This establishes mismatched event references, not whether the
cause is a reused key, stale code assignment, or incorrect backend metadata.

The external Laravel implementation is not present in this repository.
Sending `event_id` is only the client side of the correction; a backend that
ignores this field will continue to choose the wrong event.

## Server requirements

1. Validate optional `event_id` as an event identifier. Resolve the selected
   event within the request's authorized tenant, never across tenants.
2. If provided, validate the submitted key against **that event's** active
   attendee invite keys. Do not resolve the first global match for the key.
   Retain punctuation while normalizing case and surrounding whitespace.
3. On a wrong key, nonexistent event, or tenant mismatch, return a failure
   without creating membership or check-in in any other event.
4. On a correct key, transactionally create or reactivate the authenticated
   user's audience membership in that exact event according to existing
   revocation policies. Preserve existing event-specific sponsor privileges.
   Apply the normal idempotent check-in behavior.
5. Return the selected event's `event_id`, its actual `membership_id`, and
   `auto_checked_in`. Subsequent `/access`, `/members`, and `/attendees` calls
   must expose consistent active membership for that account and event.
6. Keep the code-only entry point for users who have not selected an event.
   If its key matches multiple eligible events, fail with an ambiguity error
   instead of silently registering the first event.

## Verification on the external backend

- Create two nonproduction events with the same valid key. Joining the second
  by explicit `event_id` must register only the second event and return its ID.
- An invalid key for the requested event must not join the other event even
  when that other event accepts the key.
- Existing audience and sponsor-rep access must remain idempotent and retain
  the appropriate event-specific role.
- Confirm audience registration and subsequent key-free re-entry using a
  designated test account, without logging keys, tokens, or personal data.
- Inspect the affected event records and invite-key assignment before changing
  any live data. Do not delete or transfer accidental memberships automatically.
