---
name: Giveaway read/delete ordering
description: Why successful deletion alone is not sufficient to trust a later giveaway list response.
---

Preserve optimistic deletion intent across successful DELETE completion; retire it only on a real deletion failure or at the end of the client session. Scope that intent by both account and event.

**Why:** A GET can capture its snapshot before deletion yet finish after DELETE succeeds. Dropping the deletion guard as soon as DELETE returns allows that older snapshot to resurrect the card. Failure must restore visibility, while unrelated events or accounts must never inherit a hidden prize.

**How to apply:** Any giveaway list hydration or refresh must respect current deletion intent at state-merge time. Regression checks should deliberately hold the stale GET and DELETE independently and exercise both response orders, plus failed-delete rollback.
