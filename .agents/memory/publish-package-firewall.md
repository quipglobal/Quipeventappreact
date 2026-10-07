---
name: Publishing dependency firewall
description: Why a successful cached install does not establish that publishing can reinstall a locked dependency.
---

Cached local package installs can succeed while a clean publish install is blocked by a newly disclosed vulnerability in the locked dependency tree.

**Why:** Publishing performs a clean dependency installation, which downloads tarballs and rechecks security policy. The initial cached installation can pass even when a subsequent clean installation rejects an old transitive version.

**How to apply:** Inspect the latest build's terminal error rather than assuming an earlier publishing failure has recurred. Resolve blocked versions through the configured package firewall, keep compatible patched minimums reproducible in the manifest and lockfile, and retain integrity hashes without persisting workspace-only download URLs.
