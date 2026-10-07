---
name: Publishing dependency firewall
description: Why a successful cached install does not establish that publishing can reinstall a locked dependency.
---

Cached local package installs can succeed while a clean publish install is blocked by a newly disclosed vulnerability in the locked dependency tree.

**Why:** Publishing performs a clean dependency installation, which downloads tarballs and rechecks security policy. The initial cached installation can pass even when a subsequent clean installation rejects an old transitive version.

**How to apply:** Inspect the latest build's terminal error rather than assuming an earlier publishing failure has recurred. Resolve blocked versions through the configured package firewall, keep compatible patched minimums reproducible in the manifest and lockfile, and retain integrity hashes without persisting workspace-only download URLs.

When no patched parent release exists, verify whether the vulnerable dependency is actually needed before accepting a forced downgrade or introducing a compatibility shim.

**Why:** The audit's proposed proxy middleware downgrade was not a compatible fix; newer parent releases still carried the same vulnerable glob chain. Removing an unused dependency avoided changing the working proxy or runtime.

**How to apply:** Check both development and production consumers and smoke-test their behavior. A newer major release is not evidence that its transitive advisories have been resolved.
