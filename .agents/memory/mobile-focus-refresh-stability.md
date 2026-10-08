---
name: Mobile focus refresh stability
description: Why navigation-driven query invalidation needs stable callback dependencies.
---

Navigation focus callbacks that invalidate queries must depend on stable semantic query identity, not newly allocated key arrays.

**Why:** Expo Router reruns a focus effect when its callback changes while the screen remains focused. Query invalidation updates the observer and causes another render; fresh array dependencies can turn that render into another invalidation instead of one fetch per visit.

**How to apply:** When changing mobile freshness behavior, test that request counts stop increasing after loading and result renders, as well as checking blur/focus and unmount/remount. Stabilize query keys or focus dependencies when their contents have not changed.
