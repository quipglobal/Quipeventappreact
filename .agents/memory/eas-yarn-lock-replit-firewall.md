---
name: EAS Yarn Lock Replit Firewall URLs
description: yarn.lock entries written inside Replit point to package-firewall.replit.local; EAS build workers can't resolve this hostname and fail at yarn install.
---

## Rule
Before every EAS build triggered from this Replit workspace, rewrite Replit-firewall URLs in the staged yarn.lock:

```bash
sed 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' \
  mobile/yarn.lock > /tmp/mobile-build/yarn.lock
```

**Why:** Replit routes all npm/yarn installs through an internal transparent proxy at `package-firewall.replit.local`. Any `yarn add` run inside Replit records that host as the `resolved` URL in yarn.lock. EAS cloud build workers have no route to that hostname → `getaddrinfo ENOTFOUND` → build fails at "Install dependencies". Only 14 entries were affected the first time but any subsequent `yarn add` in Replit adds more.

**How to apply:** Apply the `sed` in the `/tmp/mobile-build` staging step (after copying `yarn.lock` from `mobile/`, before running `eas build`). The package hashes remain valid — Replit's firewall is a transparent cache of the same tarballs on npmjs.org.

**Verification:** `grep -c "package-firewall.replit.local" /tmp/mobile-build/yarn.lock` must return 0 (grep exits 1 with 0 matches — that's correct).
