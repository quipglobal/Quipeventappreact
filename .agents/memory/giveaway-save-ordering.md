---
name: Giveaway save ordering
description: The read-before-save-acknowledgement race that concurrent giveaway regression checks must exercise.
---

Do not assume a prize's save acknowledgement reaches the browser before a company list refresh can discover that prize. Exercise concurrent saves with the first refresh returning both prizes while the second save acknowledgement remains pending.

**Why:** Holding every refresh until all save acknowledgements arrive misses the important race: the client can simultaneously have an optimistic prize and a server-discovered version of that same prize. Duplicate ownership entries can then cause a later refresh to hide the prize from company management.

**How to apply:** When changing giveaway save/list reconciliation, cover both save acknowledgement orders, omit server ownership metadata, and assert each prize appears exactly once in the managed section after the subsequent refresh.
